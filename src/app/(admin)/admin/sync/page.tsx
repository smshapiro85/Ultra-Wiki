import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileTree } from "./file-tree";
import { SyncDashboard } from "./sync-dashboard";
import { loadFileTree, getRecentSyncLogs, getActiveSyncStatus } from "./actions";

async function FileTreeLoader() {
  const fileTreeData = await loadFileTree();
  return (
    <FileTree
      tree={fileTreeData.tree}
      initialIncludedPaths={fileTreeData.includedPaths}
      error={fileTreeData.error}
    />
  );
}

function FileTreeSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${(i % 3) * 16}px` }}>
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4" style={{ width: `${100 + (i * 20) % 120}px` }} />
        </div>
      ))}
    </div>
  );
}

export default async function SyncPage() {
  const [syncLogs, activeSync] = await Promise.all([
    getRecentSyncLogs(),
    getActiveSyncStatus(),
  ]);

  const isRunning = activeSync?.isRunning ?? false;

  const fileTreeCard = (
    <Card>
      <CardHeader>
        <CardTitle>Repository Files</CardTitle>
        <CardDescription>
          Select files and folders to include in sync. All files are excluded
          by default.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<FileTreeSkeleton />}>
          <FileTreeLoader />
        </Suspense>
      </CardContent>
    </Card>
  );

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

      <SyncDashboard
        initialLogs={syncLogs}
        initialIsRunning={isRunning}
        initialStartedAt={activeSync?.startedAt}
        initialSyncLogId={activeSync?.syncLogId}
        fileTreeCard={fileTreeCard}
      />
    </div>
  );
}
