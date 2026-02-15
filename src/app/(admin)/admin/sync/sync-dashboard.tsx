"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SyncTrigger } from "./sync-trigger";
import { SyncHistory } from "./sync-history";
import type { SyncLogEntry } from "./actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncDashboardProps {
  initialLogs: SyncLogEntry[];
  initialIsRunning: boolean;
  initialStartedAt?: Date;
  initialSyncLogId?: string;
  /** Rendered inside the left column of the grid (File Tree card) */
  fileTreeCard: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SyncDashboard({
  initialLogs,
  initialIsRunning,
  initialStartedAt,
  initialSyncLogId,
  fileTreeCard,
}: SyncDashboardProps) {
  const [logs, setLogs] = useState<SyncLogEntry[]>(initialLogs);
  const [isRunning, setIsRunning] = useState(initialIsRunning);
  const [startedAt, setStartedAt] = useState<Date | undefined>(
    initialStartedAt
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for sync completion when running without an active SSE connection
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/sync/status");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.isRunning) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setIsRunning(false);
          const logsRes = await fetch("/api/admin/sync/logs");
          if (logsRes.ok) {
            setLogs(await logsRes.json());
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  // If page loaded with a running sync, start polling for completion
  useEffect(() => {
    if (initialIsRunning) {
      startPolling();
    }
  }, [initialIsRunning, startPolling]);

  // Called by SyncTrigger when SSE emits syncLogId
  const handleSyncStart = useCallback((syncLogId: string) => {
    const now = new Date();
    setIsRunning(true);
    setStartedAt(now);

    // Add optimistic running row
    setLogs((prev) => {
      if (prev.some((l) => l.id === syncLogId)) return prev;
      const optimistic: SyncLogEntry = {
        id: syncLogId,
        status: "running",
        triggerType: "manual",
        filesProcessed: 0,
        articlesCreated: 0,
        articlesUpdated: 0,
        totalInputTokens: null,
        totalOutputTokens: null,
        estimatedCostUsd: null,
        startedAt: now,
        completedAt: null,
        errorMessage: null,
        createdAt: now,
        durationMs: null,
      };
      return [optimistic, ...prev];
    });
  }, []);

  // Called by SyncTrigger on done/error
  const handleSyncComplete = useCallback(async () => {
    setIsRunning(false);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    try {
      const res = await fetch("/api/admin/sync/logs");
      if (res.ok) {
        setLogs(await res.json());
      }
    } catch {
      // User can refresh manually
    }
  }, []);

  return (
    <>
      {/* Status Banner */}
      {isRunning && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500" />
          </span>
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <span className="font-medium">Sync in progress...</span>
            {startedAt && (
              <span className="ml-2 text-blue-600 dark:text-blue-300">
                Started {formatDate(startedAt)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Two-column grid: File Tree (wider) | Sync Controls (narrower) */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {fileTreeCard}

        <Card>
          <CardHeader>
            <CardTitle>Manual Sync</CardTitle>
            <CardDescription>
              Trigger a sync to fetch the latest file tree from GitHub, detect
              changes, and update file metadata.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SyncTrigger
              disabled={isRunning}
              onSyncStart={handleSyncStart}
              onSyncComplete={handleSyncComplete}
              initialIsRunning={initialIsRunning}
              initialSyncLogId={initialSyncLogId}
            />
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
          <SyncHistory logs={logs} />
        </CardContent>
      </Card>
    </>
  );
}
