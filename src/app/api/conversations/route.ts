import { NextResponse } from "next/server";
import { desc, eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { aiConversations } from "@/lib/db/schema";

/**
 * GET /api/conversations
 *
 * List conversations for the current user.
 * Query params:
 *   - mode: "global" | "page"
 *   - articleId: (optional, required for page mode)
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "global";
  const articleId = searchParams.get("articleId");

  const db = getDb();

  const conditions = [
    eq(aiConversations.userId, session.user.id),
    eq(aiConversations.mode, mode as "global" | "page"),
  ];

  if (mode === "page" && articleId) {
    conditions.push(eq(aiConversations.articleId, articleId));
  }

  const rows = await db
    .select({
      id: aiConversations.id,
      title: aiConversations.title,
      mode: aiConversations.mode,
      articleId: aiConversations.articleId,
      updatedAt: aiConversations.updatedAt,
    })
    .from(aiConversations)
    .where(and(...conditions))
    .orderBy(desc(aiConversations.updatedAt));

  return NextResponse.json(rows);
}

/**
 * POST /api/conversations
 *
 * Create a new conversation.
 * Body: { mode: "global" | "page", articleId?: string, title: string }
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { mode: "global" | "page"; articleId?: string; title: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.mode || !body.title) {
    return NextResponse.json(
      { error: "mode and title are required" },
      { status: 400 }
    );
  }

  const db = getDb();
  const [conversation] = await db
    .insert(aiConversations)
    .values({
      userId: session.user.id,
      mode: body.mode,
      articleId: body.mode === "page" ? body.articleId : null,
      title: body.title,
    })
    .returning({
      id: aiConversations.id,
      title: aiConversations.title,
      mode: aiConversations.mode,
    });

  return NextResponse.json(conversation, { status: 201 });
}
