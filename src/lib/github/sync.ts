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
import { setSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/settings/constants";

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
    articlesCreated: number;
    articlesUpdated: number;
  };
}

export interface SyncOptions {
  onLog?: (message: string) => void;
  onSyncLogId?: (syncLogId: string) => void;
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
    articlesCreated?: number;
    articlesUpdated?: number;
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
      articlesCreated: stats.articlesCreated ?? 0,
      articlesUpdated: stats.articlesUpdated ?? 0,
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
 *   6.5. Run AI pipeline on changed files
 *   7. Release lock with stats (including article counts)
 *
 * The sync lock is held until AFTER the AI pipeline completes,
 * preventing race conditions between sync and AI processing.
 *
 * Returns sync result with stats or error information.
 */
export async function runSync(
  triggerType: "manual" | "scheduled",
  options?: SyncOptions
): Promise<SyncResult> {
  const log = options?.onLog;

  // 1. Acquire lock
  log?.("Acquiring sync lock...");
  const syncLogId = await acquireSyncLock(triggerType);
  if (!syncLogId) {
    return {
      success: false,
      error: "A sync is already in progress. Please wait for it to complete.",
    };
  }

  // Notify caller of the sync log ID as early as possible
  options?.onSyncLogId?.(syncLogId);

  try {
    // 2. Read included patterns
    const db = getDb();
    const patterns = await db
      .select({ pattern: excludedPaths.pattern })
      .from(excludedPaths);
    const includedPatterns = patterns.map((p) => p.pattern);

    // 3. Get Octokit + repo config
    log?.("Connecting to GitHub...");
    const [octokit, config] = await Promise.all([
      getOctokit(),
      getRepoConfig(),
    ]);

    // 4. Fetch remote tree (with retry for transient errors)
    log?.("Fetching repository file tree...");
    const remoteTree = await withRetry(() =>
      fetchRepoTree(octokit, config.owner, config.repo, config.branch)
    );
    const blobCount = remoteTree.filter((f) => f.type === "blob").length;
    log?.(`File tree loaded: ${blobCount} files found`);

    // 4.5. Cache the full tree so the admin file-picker loads from DB, not GitHub
    await setSetting(
      SETTING_KEYS.cached_repo_tree,
      JSON.stringify(remoteTree),
      false
    );

    // 5. Detect changes
    log?.("Detecting changes...");
    const changeSet = await detectChanges(remoteTree, includedPatterns);
    const totalChanged =
      changeSet.added.length + changeSet.modified.length + changeSet.removed.length;
    log?.(
      `Changes detected: ${changeSet.added.length} added, ${changeSet.modified.length} modified, ${changeSet.removed.length} removed`
    );

    // 6. Apply changes
    if (totalChanged > 0) {
      log?.(`Applying ${totalChanged} file changes...`);
    }
    const { filesProcessed } = await applyChanges(changeSet);

    // 6.5. Run AI pipeline on changed files (while lock is still held)
    // Dynamic import to avoid pulling BlockNote/JSDOM into the module graph
    // at build time (causes createContext error during static page collection).
    const changedFilePaths = [
      ...changeSet.added.map((f) => f.path),
      ...changeSet.modified.map((f) => f.path),
    ];
    let aiStats = { articlesCreated: 0, articlesUpdated: 0 };
    if (changedFilePaths.length > 0) {
      log?.(`Running AI analysis on ${changedFilePaths.length} files...`);
      try {
        const { runAIPipeline } = await import("@/lib/ai/pipeline");
        aiStats = await runAIPipeline(syncLogId, changedFilePaths, {
          onLog: log,
        });
        log?.(
          `AI analysis complete: ${aiStats.articlesCreated} articles created, ${aiStats.articlesUpdated} updated`
        );
      } catch (error) {
        // AI pipeline failure should NOT fail the sync -- log and continue
        console.error("[sync] AI pipeline error:", error);
        log?.("AI analysis failed -- continuing without article updates");
      }
    } else {
      log?.("No changed files -- skipping AI analysis");
    }

    const stats = {
      filesProcessed,
      added: changeSet.added.length,
      modified: changeSet.modified.length,
      removed: changeSet.removed.length,
      articlesCreated: aiStats.articlesCreated,
      articlesUpdated: aiStats.articlesUpdated,
    };

    // 7. Release lock with success (including article counts)
    await releaseSyncLock(syncLogId, "completed", {
      filesProcessed,
      articlesCreated: aiStats.articlesCreated,
      articlesUpdated: aiStats.articlesUpdated,
    });

    log?.(
      `Sync complete: ${filesProcessed} files processed, ${aiStats.articlesCreated + aiStats.articlesUpdated} articles updated`
    );

    return { success: true, syncLogId, stats };
  } catch (error) {
    // Release lock with failure
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    await releaseSyncLock(syncLogId, "failed", {
      error: errorMessage,
    });
    log?.(`Sync failed: ${errorMessage}`);

    return {
      success: false,
      syncLogId,
      error: errorMessage,
    };
  }
}
