import { NextResponse } from "next/server";
import { isSyncDue } from "@/lib/github/schedule";
import { runSync } from "@/lib/github/sync";

/**
 * POST /api/admin/sync/cron
 *
 * Cron-triggered sync endpoint. An external cron job (host crontab, Docker
 * sidecar, or platform scheduler) calls this route at a fixed interval
 * (e.g., every 5 minutes). The route:
 *
 *   1. Authenticates via Bearer CRON_SECRET token (machine-to-machine auth)
 *   2. Checks whether the admin-configured schedule says a sync is due
 *   3. Runs the sync only when due, using the same engine as manual sync
 *
 * No session/user auth -- this is a service endpoint.
 */
export async function POST(request: Request) {
  // 1. Validate CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn("[cron-sync] CRON_SECRET environment variable is not configured");
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token || token !== cronSecret) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 2. Check if a sync is due based on admin-configured schedule
  try {
    const due = await isSyncDue();
    if (!due) {
      return NextResponse.json({
        skipped: true,
        reason: "Not scheduled yet",
      });
    }

    // 3. Run the sync
    const result = await runSync("scheduled");

    if (result.success) {
      return NextResponse.json({
        success: true,
        syncLogId: result.syncLogId,
        stats: result.stats,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: result.error,
        syncLogId: result.syncLogId,
      },
      { status: 500 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error("[cron-sync] Unexpected error:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
