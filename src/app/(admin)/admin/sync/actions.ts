"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { excludedPaths, syncLogs } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/settings/constants";
import { getOctokit, getRepoConfig } from "@/lib/github/client";
import {
  fetchRepoTree,
  buildTreeStructure,
  type TreeNode,
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

  const repoUrl = await getSetting(SETTING_KEYS.github_repo_url);
  const apiKey = await getSetting(SETTING_KEYS.github_api_key);

  if (!repoUrl || !apiKey) {
    return {
      tree: [],
      includedPaths: [],
      error:
        "Configure your GitHub repository URL and API key in Settings to browse the file tree.",
    };
  }

  try {
    const octokit = await getOctokit();
    const config = await getRepoConfig();
    const rawTree = await fetchRepoTree(
      octokit,
      config.owner,
      config.repo,
      config.branch
    );
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

export async function getRecentSyncLogs(): Promise<
  {
    id: string;
    status: string;
    triggerType: string;
    filesProcessed: number;
    startedAt: Date | null;
    completedAt: Date | null;
    errorMessage: string | null;
    createdAt: Date;
  }[]
> {
  await requireAdmin();
  const db = getDb();

  return db
    .select({
      id: syncLogs.id,
      status: syncLogs.status,
      triggerType: syncLogs.triggerType,
      filesProcessed: syncLogs.filesProcessed,
      startedAt: syncLogs.startedAt,
      completedAt: syncLogs.completedAt,
      errorMessage: syncLogs.errorMessage,
      createdAt: syncLogs.createdAt,
    })
    .from(syncLogs)
    .orderBy(desc(syncLogs.createdAt))
    .limit(10);
}
