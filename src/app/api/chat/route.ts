import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  aiConversations,
  aiConversationMessages,
} from "@/lib/db/schema";
import { getAIModel } from "@/lib/ai/client";
import { getArticleIndex } from "@/lib/ai/analyze";
import { getSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/settings/constants";

const DEFAULT_GLOBAL_PROMPT =
  "You are a helpful assistant for the CodeWiki documentation system. Answer questions about the wiki articles, codebase, and documentation. Be concise and accurate.";

/**
 * POST /api/chat
 *
 * Global Ask AI streaming endpoint. Loads prior conversation messages from DB,
 * appends the new user message, streams an AI response using the article index
 * as context, and persists both messages on completion.
 */
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
  const systemPrompt = customPrompt || DEFAULT_GLOBAL_PROMPT;

  // Build context: article index
  const articleIndex = await getArticleIndex();
  let contextText = "";
  if (articleIndex.length > 0) {
    contextText = "## Available Wiki Articles\n\n";
    for (const article of articleIndex) {
      contextText += `- **${article.title}** (/${article.slug}) [${article.categoryName}]${article.hasHumanEdits ? " (human-edited)" : ""}\n`;
    }
  }

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
