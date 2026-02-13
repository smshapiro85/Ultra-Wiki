import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runSync } from "@/lib/github/sync";

/**
 * POST /api/admin/sync
 * Trigger a manual sync. Requires admin authentication.
 * Alternative to the server action for programmatic access / testing.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSync("manual");

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.syncLogId ? 500 : 409 }
    );
  }

  return NextResponse.json({
    success: true,
    syncLogId: result.syncLogId,
    stats: result.stats,
  });
}
