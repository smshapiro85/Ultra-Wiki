import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { syncLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = getDb();
  const [row] = await db
    .select({
      id: syncLogs.id,
      startedAt: syncLogs.startedAt,
    })
    .from(syncLogs)
    .where(eq(syncLogs.status, "running"))
    .limit(1);

  if (!row) {
    return Response.json({ isRunning: false });
  }

  return Response.json({
    isRunning: true,
    syncLogId: row.id,
    startedAt: row.startedAt,
  });
}
