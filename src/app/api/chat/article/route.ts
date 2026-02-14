import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  articles,
  aiConversations,
  aiConversationMessages,
} from "@/lib/db/schema";
import { getAIModel } from "@/lib/ai/client";
import {
  getArticleFileLinks,
  getArticleDbTables,
} from "@/lib/wiki/queries";
import { getSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/settings/constants";

const DEFAULT_PAGE_PROMPT =
  "You are a helpful assistant for CodeWiki. Answer questions about the article and its related source code. Use the provided context to give accurate, specific answers.";

const MAX_CONTEXT_CHARS = 32000;

// -----------------------------------------------------------------------------
// Context types
// -----------------------------------------------------------------------------

export interface ContextInfo {
  articleTitle: string;
  hasArticleContent: boolean;
  hasTechnicalView: boolean;
  fileCount: number;
  tableCount: number;
}

// -----------------------------------------------------------------------------
// buildArticleContext
// -----------------------------------------------------------------------------

async function buildArticleContext(
  articleId: string
): Promise<{ contextText: string; contextInfo: ContextInfo }> {
  const db = getDb();

  const [articleRows, fileLinks, dbTables] = await Promise.all([
    db
      .select({
        title: articles.title,
        contentMarkdown: articles.contentMarkdown,
        technicalViewMarkdown: articles.technicalViewMarkdown,
      })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1),
    getArticleFileLinks(articleId),
    getArticleDbTables(articleId),
  ]);

  const article = articleRows[0];
  if (!article) {
    return {
      contextText: "",
      contextInfo: {
        articleTitle: "Unknown",
        hasArticleContent: false,
        hasTechnicalView: false,
        fileCount: 0,
        tableCount: 0,
      },
    };
  }

  const contextInfo: ContextInfo = {
    articleTitle: article.title,
    hasArticleContent: !!article.contentMarkdown,
    hasTechnicalView: !!article.technicalViewMarkdown,
    fileCount: fileLinks.length,
    tableCount: dbTables.length,
  };

  // Build file and table sections first (small, no truncation needed)
  let fileSectionText = "";
  if (fileLinks.length > 0) {
    fileSectionText = "\n\n## Related Source Files\n";
    for (const f of fileLinks) {
      fileSectionText += `- ${f.filePath}: ${f.aiSummary || "No summary"}\n`;
    }
  }

  let tableSectionText = "";
  if (dbTables.length > 0) {
    tableSectionText = "\n\n## Related Database Tables\n";
    for (const t of dbTables) {
      tableSectionText += `- ${t.tableName}: ${t.relevanceExplanation || ""}\n`;
    }
  }

  const fixedSectionsLength = fileSectionText.length + tableSectionText.length;
  const budgetForContent = MAX_CONTEXT_CHARS - fixedSectionsLength - 200; // 200 chars for headers

  // Truncate content and technical view if needed
  let contentMd = article.contentMarkdown || "";
  let techViewMd = article.technicalViewMarkdown || "";

  if (contentMd.length + techViewMd.length > budgetForContent) {
    console.warn(
      `[chat/article] Context exceeds ${MAX_CONTEXT_CHARS} chars for article "${article.title}". Truncating.`
    );
    // Split budget: 70% for content, 30% for technical view
    const contentBudget = Math.floor(budgetForContent * 0.7);
    const techBudget = budgetForContent - contentBudget;

    if (contentMd.length > contentBudget) {
      contentMd = contentMd.slice(0, contentBudget) + "\n\n[Content truncated]";
    }
    if (techViewMd.length > techBudget) {
      techViewMd = techViewMd.slice(0, techBudget) + "\n\n[Technical view truncated]";
    }
  }

  let contextText = `## Article: ${article.title}\n\n${contentMd}`;

  contextText += `\n\n## Technical View\n${techViewMd || "No technical view content."}`;

  contextText += fileSectionText;
  contextText += tableSectionText;

  return { contextText, contextInfo };
}

// -----------------------------------------------------------------------------
// POST /api/chat/article
// -----------------------------------------------------------------------------

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: {
    conversationId: string;
    message: UIMessage;
    articleId: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { conversationId, message, articleId } = body;

  if (!conversationId || !message || !articleId) {
    return new Response("Missing conversationId, message, or articleId", {
      status: 400,
    });
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
  const customPrompt = await getSetting(SETTING_KEYS.ask_ai_page_prompt);
  const systemPrompt = customPrompt || DEFAULT_PAGE_PROMPT;

  // Build article context
  const { contextText, contextInfo } = await buildArticleContext(articleId);

  const fullSystemPrompt = contextText
    ? `${systemPrompt}\n\n${contextText}`
    : systemPrompt;

  // Stream the AI response
  const model = await getAIModel();
  const result = streamText({
    model,
    system: fullSystemPrompt,
    messages: await convertToModelMessages(priorMessages),
    abortSignal: req.signal,
  });

  result.consumeStream();

  const response = result.toUIMessageStreamResponse({
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
        console.error("[chat/article] Failed to persist messages:", error);
      }
    },
  });

  // Add context info header so client can display it
  response.headers.set("X-Context-Info", JSON.stringify(contextInfo));

  return response;
}
