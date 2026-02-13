import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileTree } from "./file-tree";
import { SyncTrigger } from "./sync-trigger";
import { loadFileTree, getRecentSyncLogs } from "./actions";

function formatDate(date: Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <Badge
          variant="outline"
          className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
        >
          Completed
        </Badge>
      );
    case "running":
      return (
        <Badge
          variant="outline"
          className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400"
        >
          Running
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className="border-red-300 text-red-700 dark:border-red-700 dark:text-red-400"
        >
          Failed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default async function SyncPage() {
  const [fileTreeData, syncLogs] = await Promise.all([
    loadFileTree(),
    getRecentSyncLogs(),
  ]);

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

      <div className="grid gap-6 lg:grid-cols-2">
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

        {/* Sync Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Manual Sync</CardTitle>
              <CardDescription>
                Trigger a sync to fetch the latest file tree from GitHub, detect
                changes, and update file metadata.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SyncTrigger />
            </CardContent>
          </Card>

          {/* Sync History */}
          <Card>
            <CardHeader>
              <CardTitle>Sync History</CardTitle>
              <CardDescription>
                Last 10 sync operations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {syncLogs.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No syncs have been run yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Files</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Completed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <StatusBadge status={log.status} />
                        </TableCell>
                        <TableCell className="text-sm capitalize">
                          {log.triggerType}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.filesProcessed}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-500">
                          {formatDate(log.startedAt)}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-500">
                          {formatDate(log.completedAt)}
                          {log.errorMessage && (
                            <span
                              className="ml-2 text-xs text-red-500"
                              title={log.errorMessage}
                            >
                              (error)
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
