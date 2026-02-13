import { desc, eq } from "drizzle-orm";
import { CronExpressionParser } from "cron-parser";
import { getDb } from "@/lib/db";
import { syncLogs } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/settings/constants";

/**
 * Check whether a scheduled sync is currently due.
 *
 * Reads the `sync_cron_schedule` setting from the DB. If no schedule is
 * configured, returns false (nothing to do). Otherwise, uses cron-parser
 * to find the most recent occurrence that should have fired and compares it
 * against the last successfully completed sync timestamp. If the most recent
 * cron tick is after the last completed sync (or no completed sync exists),
 * the sync is due.
 */
export async function isSyncDue(): Promise<boolean> {
  // 1. Read the admin-configured cron schedule
  const schedule = await getSetting(SETTING_KEYS.sync_cron_schedule);
  if (!schedule || schedule.trim() === "") {
    return false; // No schedule configured
  }

  // 2. Parse the cron expression
  let iterator;
  try {
    iterator = CronExpressionParser.parse(schedule);
  } catch {
    // Invalid cron expression -- treat as "not configured"
    console.warn(`[schedule] Invalid cron expression: "${schedule}"`);
    return false;
  }

  // 3. Find the last completed sync
  const db = getDb();
  const [lastCompleted] = await db
    .select({ completedAt: syncLogs.completedAt })
    .from(syncLogs)
    .where(eq(syncLogs.status, "completed"))
    .orderBy(desc(syncLogs.completedAt))
    .limit(1);

  // 4. If no completed syncs exist, the sync is due
  if (!lastCompleted?.completedAt) {
    return true;
  }

  // 5. Find the most recent cron tick (prev() from current time)
  const prevTick = iterator.prev().toDate();

  // 6. Sync is due if the prev tick is after the last completed sync
  return prevTick.getTime() > lastCompleted.completedAt.getTime();
}
