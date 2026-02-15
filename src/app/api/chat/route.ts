import {
  generateText,
  Output,
  streamText,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { z } from "zod/v4";
import { eq, asc, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  articles,
  categories,
  aiConversations,
  aiConversationMessages,
} from "@/lib/db/schema";
import { getAskAIGlobalModel } from "@/lib/ai/client";
import { getArticleIndex } from "@/lib/ai/analyze";
import { getSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/settings/constants";

// ---------------------------------------------------------------------------
// Schema for Step 1: article selection
// ---------------------------------------------------------------------------

const articleSelectionSchema = z.object({
  reasoning: z
    .string()
    .describe(
      "Why these articles are relevant, or why none are needed"
    ),
  slugs: z
    .array(z.string())
    .max(5)
    .describe("Article slugs relevant to the question"),
});

// ---------------------------------------------------------------------------
// Step 1 helper: select relevant articles via structured output
// ---------------------------------------------------------------------------

async function selectRelevantArticles(
  model: Awaited<ReturnType<typeof getAskAIGlobalModel>>,
  articleIndex: Array<{
    slug: string;
    title: string;
    categoryName: string;
    hasHumanEdits: boolean;
  }>,
  messages: Awaited<ReturnType<typeof convertToModelMessages>>,
  abortSignal: AbortSignal
): Promise<{ slugs: string[]; reasoning: string }> {
  const indexListing = articleIndex
    .map(
      (a) =>
        `- "${a.title}" (slug: ${a.slug}) [${a.categoryName}]`
    )
    .join("\n");

  // Use only the last 4 messages for efficiency
  const recentMessages = messages.slice(-4);

  const { experimental_output } = await generateText({
    model,
    system: `You are an article selector for an internal wiki. Given the user's question and the article index below, select which articles (by slug) are most relevant to answering the question. Return up to 5 slugs.

If the message is conversational (greetings, thanks, follow-ups that don't need article content), return an empty slugs array.

## Article Index
${indexListing}`,
    messages: recentMessages,
    experimental_output: Output.object({ schema: articleSelectionSchema }),
    temperature: 0.1,
    abortSignal,
  });

  if (!experimental_output) {
    return { slugs: [], reasoning: "No output from article selection" };
  }

  return {
    slugs: experimental_output.slugs,
    reasoning: experimental_output.reasoning,
  };
}

// ---------------------------------------------------------------------------
// Step 2 helper: load full article content for selected slugs
// ---------------------------------------------------------------------------

const MULTI_ARTICLE_BUDGET = 32_000;

async function buildMultiArticleContext(
  slugs: string[]
): Promise<{ contextText: string; articleCount: number }> {
  if (slugs.length === 0) {
    return { contextText: "", articleCount: 0 };
  }

  const db = getDb();

  const rows = await db
    .select({
      title: articles.title,
      slug: articles.slug,
      contentMarkdown: articles.contentMarkdown,
      technicalViewMarkdown: articles.technicalViewMarkdown,
      categoryName: categories.name,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(inArray(articles.slug, slugs));

  if (rows.length === 0) {
    return { contextText: "", articleCount: 0 };
  }

  const perArticleBudget = Math.floor(MULTI_ARTICLE_BUDGET / rows.length);

  let contextText = "## Retrieved Article Content\n\n";

  for (const row of rows) {
    let contentMd = row.contentMarkdown || "";
    let techViewMd = row.technicalViewMarkdown || "";

    // 70% content / 30% technical view (same ratio as page-level route)
    const contentBudget = Math.floor(perArticleBudget * 0.7);
    const techBudget = perArticleBudget - contentBudget;

    if (contentMd.length > contentBudget) {
      contentMd =
        contentMd.slice(0, contentBudget) + "\n\n[Content truncated]";
    }
    if (techViewMd.length > techBudget) {
      techViewMd =
        techViewMd.slice(0, techBudget) + "\n\n[Technical view truncated]";
    }

    contextText += `### ${row.title} (/${row.slug}) [${row.categoryName ?? "Uncategorized"}]\n\n`;
    contextText += contentMd;
    if (techViewMd) {
      contextText += `\n\n#### Technical View\n${techViewMd}`;
    }
    contextText += "\n\n---\n\n";
  }

  return { contextText, articleCount: rows.length };
}

// ---------------------------------------------------------------------------
// POST /api/chat
//
// Global Ask AI streaming endpoint. Two-step process:
// 1. Identify relevant articles from the question (structured output)
// 2. Load article content and stream a detailed answer
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: {
    conversationId: string;
    message: UIMessage;
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { conversationId, message } = body;

  if (!conversationId || !message) {
    return new Response("Missing conversationId or message", { status: 400 });
  }

  // Verify conversation belongs to this user
  const db = getDb();
  const [conversation] = await db
    .select({ id: aiConversations.id, userId: aiConversations.userId })
    .from(aiConversations)
    .where(eq(aiConversations.id, conversationId))
    .limit(1);

  if (!conversation || conversation.userId !== session.user.id) {
    return new Response("Conversation not found", { status: 404 });
  }

  // Load prior messages from DB
  const priorDbMessages = await db
    .select({
      id: aiConversationMessages.id,
      role: aiConversationMessages.role,
      content: aiConversationMessages.content,
    })
    .from(aiConversationMessages)
    .where(eq(aiConversationMessages.conversationId, conversationId))
    .orderBy(asc(aiConversationMessages.createdAt));

  // Reconstruct UIMessage array from DB records
  const priorMessages: UIMessage[] = priorDbMessages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    parts: [{ type: "text" as const, text: m.content }],
  }));

  // Add the new user message
  priorMessages.push(message);

  // Load system prompt
  const customPrompt = await getSetting(SETTING_KEYS.ask_ai_global_prompt);
  const systemPrompt = customPrompt || "";

  // Load article index
  const articleIndex = await getArticleIndex();

  const model = await getAskAIGlobalModel();
  const modelMessages = await convertToModelMessages(priorMessages);

  // Step 1: Select relevant articles (skip if wiki is empty)
  let articleContextText = "";
  if (articleIndex.length > 0) {
    try {
      const { slugs } = await selectRelevantArticles(
        model,
        articleIndex,
        modelMessages,
        req.signal
      );

      // Step 2: Load full content for selected articles
      if (slugs.length > 0) {
        const { contextText } = await buildMultiArticleContext(slugs);
        articleContextText = contextText;
      }
    } catch (error) {
      // If Step 1 fails (e.g. client disconnect), continue without article content
      if ((error as Error).name === "AbortError") {
        throw error;
      }
      console.error("[chat] Article selection failed, continuing without article content:", error);
    }
  }

  // Build article index listing (always included)
  let indexText = "";
  if (articleIndex.length > 0) {
    indexText = "## Full Article Index\n\n";
    for (const article of articleIndex) {
      indexText += `- **${article.title}** (/${article.slug}) [${article.categoryName}]${article.hasHumanEdits ? " (human-edited)" : ""}\n`;
    }
  }

  // Assemble full system prompt: base prompt + article content + article index
  let fullSystemPrompt = systemPrompt;
  if (articleContextText) {
    fullSystemPrompt += `\n\n${articleContextText}`;
  }
  if (indexText) {
    fullSystemPrompt += `\n\n${indexText}`;
  }

  // Stream the AI response
  const result = streamText({
    model,
    system: fullSystemPrompt,
    messages: modelMessages,
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse({
    onFinish: async ({ messages: allMessages }) => {
      try {
        // Extract the new user message content
        const userTextPart = message.parts?.find(
          (p): p is { type: "text"; text: string } => p.type === "text"
        );
        const userContent = userTextPart?.text ?? "";

        // Save user message
        await db.insert(aiConversationMessages).values({
          conversationId,
          role: "user",
          content: userContent,
        });

        // Save assistant response -- last message in allMessages
        const lastMsg = allMessages?.[allMessages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          const assistantTextPart = lastMsg.parts?.find(
            (p): p is { type: "text"; text: string } => p.type === "text"
          );
          const assistantContent = assistantTextPart?.text ?? "";
          if (assistantContent) {
            await db.insert(aiConversationMessages).values({
              conversationId,
              role: "assistant",
              content: assistantContent,
            });
          }
        }

        // Update conversation timestamp
        await db
          .update(aiConversations)
          .set({ updatedAt: new Date() })
          .where(eq(aiConversations.id, conversationId));
      } catch (error) {
        console.error("[chat] Failed to persist messages:", error);
      }
    },
  });
}
