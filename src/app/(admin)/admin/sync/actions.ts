"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { excludedPaths, syncLogs } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/settings/constants";
import {
  buildTreeStructure,
  type TreeNode,
  type TreeFile,
} from "@/lib/github/tree";
import { runSync } from "@/lib/github/sync";

// ---------------------------------------------------------------------------
// Auth Helper
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized: Admin access required");
  }
  return session;
}

// ---------------------------------------------------------------------------
// File Tree
// ---------------------------------------------------------------------------

export async function loadFileTree(): Promise<{
  tree: TreeNode[];
  includedPaths: string[];
  error?: string;
}> {
  await requireAdmin();

  try {
    // Read the cached tree snapshot stored during the last sync
    const cachedJson = await getSetting(SETTING_KEYS.cached_repo_tree);

    if (!cachedJson) {
      return {
        tree: [],
        includedPaths: [],
        error:
          "No repository data yet. Run a sync first to fetch the file tree from GitHub.",
      };
    }

    const rawTree: TreeFile[] = JSON.parse(cachedJson);
    const tree = buildTreeStructure(rawTree);

    // Load included patterns from excludedPaths table (repurposed as included paths)
    const db = getDb();
    const patterns = await db
      .select({ pattern: excludedPaths.pattern })
      .from(excludedPaths);
    const includedPaths = patterns.map((p) => p.pattern);

    return { tree, includedPaths };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load file tree";
    return { tree: [], includedPaths: [], error: message };
  }
}

// ---------------------------------------------------------------------------
// Save Included Paths
// ---------------------------------------------------------------------------

export async function saveIncludedPaths(
  paths: string[]
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin();
  const db = getDb();

  try {
    // Delete all existing inclusion rules
    await db.delete(excludedPaths);

    // Insert new inclusion rules
    if (paths.length > 0) {
      await db.insert(excludedPaths).values(
        paths.map((pattern) => ({
          pattern,
          createdBy: session.user.id,
        }))
      );
    }

    revalidatePath("/admin/sync");
    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save inclusion rules";
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Sync Operations
// ---------------------------------------------------------------------------

export async function triggerManualSync(): Promise<{
  success: boolean;
  syncLogId?: string;
  error?: string;
}> {
  await requireAdmin();

  const result = await runSync("manual");
  if (result.success) {
    revalidatePath("/admin/sync");
  }
  return {
    success: result.success,
    syncLogId: result.syncLogId,
    error: result.error,
  };
}

export async function getSyncStatus(
  syncLogId: string
): Promise<{
  status: string;
  filesProcessed: number;
  error?: string;
} | null> {
  await requireAdmin();
  const db = getDb();

  const [row] = await db
    .select({
      status: syncLogs.status,
      filesProcessed: syncLogs.filesProcessed,
      errorMessage: syncLogs.errorMessage,
    })
    .from(syncLogs)
    .where(eq(syncLogs.id, syncLogId))
    .limit(1);

  if (!row) return null;

  return {
    status: row.status,
    filesProcessed: row.filesProcessed,
    error: row.errorMessage ?? undefined,
  };
}

export async function getActiveSyncStatus(): Promise<{
  isRunning: boolean;
  syncLogId?: string;
  startedAt?: Date;
} | null> {
  await requireAdmin();
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
    return { isRunning: false };
  }

  return {
    isRunning: true,
    syncLogId: row.id,
    startedAt: row.startedAt ?? undefined,
  };
}

export interface SyncLogEntry {
  id: string;
  status: string;
  triggerType: string;
  filesProcessed: number;
  articlesCreated: number;
  articlesUpdated: number;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  durationMs: number | null;
}

export async function getRecentSyncLogs(): Promise<SyncLogEntry[]> {
  await requireAdmin();
  const db = getDb();

  const rows = await db
    .select({
      id: syncLogs.id,
      status: syncLogs.status,
      triggerType: syncLogs.triggerType,
      filesProcessed: syncLogs.filesProcessed,
      articlesCreated: syncLogs.articlesCreated,
      articlesUpdated: syncLogs.articlesUpdated,
      startedAt: syncLogs.startedAt,
      completedAt: syncLogs.completedAt,
      errorMessage: syncLogs.errorMessage,
      createdAt: syncLogs.createdAt,
    })
    .from(syncLogs)
    .orderBy(desc(syncLogs.createdAt))
    .limit(20);

  return rows.map((row) => ({
    ...row,
    durationMs:
      row.startedAt && row.completedAt
        ? new Date(row.completedAt).getTime() -
          new Date(row.startedAt).getTime()
        : null,
  }));
}
