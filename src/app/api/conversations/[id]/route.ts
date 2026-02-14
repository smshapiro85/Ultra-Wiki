import { NextResponse } from "next/server";
import { eq, asc, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { aiConversations, aiConversationMessages } from "@/lib/db/schema";

/**
 * GET /api/conversations/[id]
 *
 * Get a single conversation with all its messages.
 * Verifies the conversation belongs to the current user.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const [conversation] = await db
    .select({
      id: aiConversations.id,
      title: aiConversations.title,
      mode: aiConversations.mode,
      articleId: aiConversations.articleId,
    })
    .from(aiConversations)
    .where(
      and(
        eq(aiConversations.id, id),
        eq(aiConversations.userId, session.user.id)
      )
    )
    .limit(1);

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const messages = await db
    .select({
      id: aiConversationMessages.id,
      role: aiConversationMessages.role,
      content: aiConversationMessages.content,
      createdAt: aiConversationMessages.createdAt,
    })
    .from(aiConversationMessages)
    .where(eq(aiConversationMessages.conversationId, id))
    .orderBy(asc(aiConversationMessages.createdAt));

  return NextResponse.json({ conversation, messages });
}

/**
 * DELETE /api/conversations/[id]
 *
 * Delete a conversation. Cascade deletes all messages.
 * Verifies the conversation belongs to the current user.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  // Verify ownership
  const [conversation] = await db
    .select({ id: aiConversations.id })
    .from(aiConversations)
    .where(
      and(
        eq(aiConversations.id, id),
        eq(aiConversations.userId, session.user.id)
      )
    )
    .limit(1);

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  await db
    .delete(aiConversations)
    .where(eq(aiConversations.id, id));

  return new Response(null, { status: 204 });
}
