"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { SyncLogEntry } from "./actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

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
          className="animate-pulse border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400"
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

function TriggerBadge({ triggerType }: { triggerType: string }) {
  switch (triggerType) {
    case "manual":
      return (
        <Badge variant="secondary" className="text-xs">
          Manual
        </Badge>
      );
    case "scheduled":
      return (
        <Badge variant="secondary" className="text-xs">
          Scheduled
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-xs">
          {triggerType}
        </Badge>
      );
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SyncHistoryProps {
  logs: SyncLogEntry[];
}

export function SyncHistory({ logs }: SyncHistoryProps) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No syncs have been run yet. Use the button above to trigger your first
        sync.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Trigger</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead className="text-right">Files</TableHead>
          <TableHead>Error</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell>
              <StatusBadge status={log.status} />
            </TableCell>
            <TableCell>
              <TriggerBadge triggerType={log.triggerType} />
            </TableCell>
            <TableCell className="text-sm text-zinc-500 dark:text-zinc-400">
              {formatDate(log.startedAt)}
            </TableCell>
            <TableCell className="text-sm text-zinc-500 dark:text-zinc-400">
              {log.status === "running" ? (
                <span className="text-blue-600 dark:text-blue-400">
                  In progress...
                </span>
              ) : (
                formatDuration(log.durationMs)
              )}
            </TableCell>
            <TableCell className="text-right text-sm">
              {log.filesProcessed}
            </TableCell>
            <TableCell className="max-w-[200px]">
              {log.errorMessage ? (
                <span
                  className="block truncate text-xs text-red-600 dark:text-red-400"
                  title={log.errorMessage}
                >
                  {log.errorMessage}
                </span>
              ) : (
                <span className="text-xs text-zinc-400">-</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
