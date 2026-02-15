import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { syncLogs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import type { SyncLogEntry } from "@/app/(admin)/admin/sync/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = getDb();
  const rows = await db
    .select({
      id: syncLogs.id,
      status: syncLogs.status,
      triggerType: syncLogs.triggerType,
      filesProcessed: syncLogs.filesProcessed,
      articlesCreated: syncLogs.articlesCreated,
      articlesUpdated: syncLogs.articlesUpdated,
      totalInputTokens: syncLogs.totalInputTokens,
      totalOutputTokens: syncLogs.totalOutputTokens,
      estimatedCostUsd: syncLogs.estimatedCostUsd,
      startedAt: syncLogs.startedAt,
      completedAt: syncLogs.completedAt,
      errorMessage: syncLogs.errorMessage,
      createdAt: syncLogs.createdAt,
    })
    .from(syncLogs)
    .orderBy(desc(syncLogs.createdAt))
    .limit(20);

  const entries: SyncLogEntry[] = rows.map((row) => ({
    ...row,
    durationMs:
      row.startedAt && row.completedAt
        ? new Date(row.completedAt).getTime() -
          new Date(row.startedAt).getTime()
        : null,
  }));

  return Response.json(entries);
}
