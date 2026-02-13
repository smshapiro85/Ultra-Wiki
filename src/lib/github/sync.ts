import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  githubFiles,
  excludedPaths,
  syncLogs,
} from "@/lib/db/schema";
import { getOctokit, getRepoConfig } from "./client";
import { fetchRepoTree, isPathIncluded, type TreeFile } from "./tree";
import { withRetry } from "./retry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChangeSet {
  added: TreeFile[];
  modified: TreeFile[];
  removed: string[];
}

export interface SyncResult {
  success: boolean;
  syncLogId?: string;
  error?: string;
  stats?: {
    filesProcessed: number;
    added: number;
    modified: number;
    removed: number;
  };
}

// ---------------------------------------------------------------------------
// Concurrency Lock
// ---------------------------------------------------------------------------

/**
 * Acquire a sync lock by atomically inserting a "running" row into sync_logs
 * only if no other sync is currently running.
 *
 * Uses NOT EXISTS subquery for atomicity on the stateless Neon HTTP driver.
 */
export async function acquireSyncLock(
  triggerType: "manual" | "scheduled"
): Promise<string | null> {
  const db = getDb();
  const result = await db.execute(sql`
    INSERT INTO sync_logs (id, status, trigger_type, started_at, created_at)
    SELECT gen_random_uuid(), 'running', ${triggerType}, now(), now()
    WHERE NOT EXISTS (
      SELECT 1 FROM sync_logs WHERE status = 'running'
    )
    RETURNING id
  `);

  const row = result.rows?.[0];
  return row?.id ? String(row.id) : null;
}

/**
 * Release a sync lock by updating the sync_logs row with the final status
 * and statistics.
 */
export async function releaseSyncLock(
  syncLogId: string,
  status: "completed" | "failed",
  stats: {
    filesProcessed?: number;
    error?: string;
  }
): Promise<void> {
  const db = getDb();
  await db
    .update(syncLogs)
    .set({
      status,
      completedAt: new Date(),
      filesProcessed: stats.filesProcessed ?? 0,
      errorMessage: stats.error ?? null,
    })
    .where(eq(syncLogs.id, syncLogId));
}

// ---------------------------------------------------------------------------
// Change Detection
// ---------------------------------------------------------------------------

/**
 * Compare the remote tree (filtered by inclusion patterns) against the stored
 * github_files table to detect added, modified, and removed files.
 *
 * Only blob (file) entries are tracked in github_files -- directories are used
 * for tree display but not persisted.
 */
export async function detectChanges(
  remoteTree: TreeFile[],
  includedPatterns: string[]
): Promise<ChangeSet> {
  const db = getDb();

  // Load all currently stored files
  const storedFiles = await db
    .select({
      filePath: githubFiles.filePath,
      fileSha: githubFiles.fileSha,
    })
    .from(githubFiles);

  const storedMap = new Map(storedFiles.map((f) => [f.filePath, f.fileSha]));

  // Filter remote tree to only included blobs
  const includedRemoteFiles = remoteTree.filter(
    (f) => f.type === "blob" && isPathIncluded(f.path, includedPatterns)
  );
  const remotePaths = new Set(includedRemoteFiles.map((f) => f.path));

  const added: TreeFile[] = [];
  const modified: TreeFile[] = [];

  for (const remote of includedRemoteFiles) {
    const storedSha = storedMap.get(remote.path);
    if (storedSha === undefined) {
      added.push(remote);
    } else if (storedSha !== remote.sha) {
      modified.push(remote);
    }
  }

  // Removed: files in DB that are no longer in the included remote set
  const removed = storedFiles
    .filter((f) => !remotePaths.has(f.filePath))
    .map((f) => f.filePath);

  return { added, modified, removed };
}

// ---------------------------------------------------------------------------
// Apply Changes
// ---------------------------------------------------------------------------

/**
 * Apply a changeset to the github_files table.
 * - Added files: INSERT with filePath, fileSha, lastSyncedAt
 * - Modified files: UPDATE fileSha and lastSyncedAt
 * - Removed files: DELETE from github_files
 *
 * Note: file content is NOT fetched -- only metadata is stored.
 * Content fetching is deferred to Phase 3 (AI pipeline).
 */
export async function applyChanges(
  changeSet: ChangeSet
): Promise<{ filesProcessed: number }> {
  const db = getDb();
  const now = new Date();
  let filesProcessed = 0;

  // Insert added files
  if (changeSet.added.length > 0) {
    // Batch inserts in chunks to avoid overly large queries
    const CHUNK_SIZE = 100;
    for (let i = 0; i < changeSet.added.length; i += CHUNK_SIZE) {
      const chunk = changeSet.added.slice(i, i + CHUNK_SIZE);
      await db.insert(githubFiles).values(
        chunk.map((f) => ({
          filePath: f.path,
          fileSha: f.sha,
          lastSyncedAt: now,
          updatedAt: now,
        }))
      );
    }
    filesProcessed += changeSet.added.length;
  }

  // Update modified files
  for (const file of changeSet.modified) {
    await db
      .update(githubFiles)
      .set({
        fileSha: file.sha,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(githubFiles.filePath, file.path));
  }
  filesProcessed += changeSet.modified.length;

  // Delete removed files
  if (changeSet.removed.length > 0) {
    const CHUNK_SIZE = 100;
    for (let i = 0; i < changeSet.removed.length; i += CHUNK_SIZE) {
      const chunk = changeSet.removed.slice(i, i + CHUNK_SIZE);
      for (const filePath of chunk) {
        await db
          .delete(githubFiles)
          .where(eq(githubFiles.filePath, filePath));
      }
    }
    filesProcessed += changeSet.removed.length;
  }

  return { filesProcessed };
}

// ---------------------------------------------------------------------------
// Sync Orchestrator
// ---------------------------------------------------------------------------

/**
 * Run a full sync operation:
 *   1. Acquire concurrency lock
 *   2. Read included patterns from excludedPaths table (repurposed)
 *   3. Get Octokit client and repo config
 *   4. Fetch remote tree
 *   5. Detect changes via SHA comparison
 *   6. Apply changes to github_files
 *   7. Release lock with stats
 *
 * Returns sync result with stats or error information.
 */
export async function runSync(
  triggerType: "manual" | "scheduled"
): Promise<SyncResult> {
  // 1. Acquire lock
  const syncLogId = await acquireSyncLock(triggerType);
  if (!syncLogId) {
    return {
      success: false,
      error: "A sync is already in progress. Please wait for it to complete.",
    };
  }

  try {
    // 2. Read included patterns
    const db = getDb();
    const patterns = await db
      .select({ pattern: excludedPaths.pattern })
      .from(excludedPaths);
    const includedPatterns = patterns.map((p) => p.pattern);

    // 3. Get Octokit + repo config
    const [octokit, config] = await Promise.all([
      getOctokit(),
      getRepoConfig(),
    ]);

    // 4. Fetch remote tree (with retry for transient errors)
    const remoteTree = await withRetry(() =>
      fetchRepoTree(octokit, config.owner, config.repo, config.branch)
    );

    // 5. Detect changes
    const changeSet = await detectChanges(remoteTree, includedPatterns);

    // 6. Apply changes
    const { filesProcessed } = await applyChanges(changeSet);

    const stats = {
      filesProcessed,
      added: changeSet.added.length,
      modified: changeSet.modified.length,
      removed: changeSet.removed.length,
    };

    // 7. Release lock with success
    await releaseSyncLock(syncLogId, "completed", {
      filesProcessed,
    });

    return { success: true, syncLogId, stats };
  } catch (error) {
    // Release lock with failure
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    await releaseSyncLock(syncLogId, "failed", {
      error: errorMessage,
    });

    return {
      success: false,
      syncLogId,
      error: errorMessage,
    };
  }
}
