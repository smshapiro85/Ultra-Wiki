import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileTree } from "./file-tree";
import { SyncTrigger } from "./sync-trigger";
import { SyncHistory } from "./sync-history";
import { loadFileTree, getRecentSyncLogs, getActiveSyncStatus } from "./actions";

function formatDate(date: Date | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default async function SyncPage() {
  const [fileTreeData, syncLogs, activeSync] = await Promise.all([
    loadFileTree(),
    getRecentSyncLogs(),
    getActiveSyncStatus(),
  ]);

  const isRunning = activeSync?.isRunning ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Sync Dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage GitHub repository sync and file inclusion rules.
        </p>
      </div>

      {/* Status Banner */}
      {isRunning && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500" />
          </span>
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <span className="font-medium">Sync in progress...</span>
            {activeSync?.startedAt && (
              <span className="ml-2 text-blue-600 dark:text-blue-300">
                Started {formatDate(activeSync.startedAt)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Two-column grid: File Tree (wider) | Sync Controls (narrower) */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* File Tree Section */}
        <Card>
          <CardHeader>
            <CardTitle>Repository Files</CardTitle>
            <CardDescription>
              Select files and folders to include in sync. All files are excluded
              by default.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileTree
              tree={fileTreeData.tree}
              initialIncludedPaths={fileTreeData.includedPaths}
              error={fileTreeData.error}
            />
          </CardContent>
        </Card>

        {/* Sync Controls Section */}
        <Card>
          <CardHeader>
            <CardTitle>Manual Sync</CardTitle>
            <CardDescription>
              Trigger a sync to fetch the latest file tree from GitHub, detect
              changes, and update file metadata.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SyncTrigger disabled={isRunning} />
          </CardContent>
        </Card>
      </div>

      {/* Sync History (full width) */}
      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
          <CardDescription>
            Last 20 sync operations with status, duration, and file counts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SyncHistory logs={syncLogs} />
        </CardContent>
      </Card>
    </div>
  );
}
