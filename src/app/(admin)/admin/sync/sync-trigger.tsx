"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Loader2, Play, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerManualSync, getSyncStatus } from "./actions";

type SyncState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "running"; syncLogId: string }
  | {
      phase: "completed";
      stats: { filesProcessed: number; added: number; modified: number; removed: number };
    }
  | { phase: "error"; message: string };

interface SyncTriggerProps {
  disabled?: boolean;
}

export function SyncTrigger({ disabled }: SyncTriggerProps) {
  const [state, setState] = useState<SyncState>({ phase: "idle" });
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleSync = useCallback(async () => {
    setState({ phase: "starting" });

    try {
      const result = await triggerManualSync();

      if (!result.success) {
        setState({
          phase: "error",
          message: result.error ?? "Sync failed",
        });
        return;
      }

      // Sync completed (runSync is synchronous in its orchestration)
      // But we still poll in case it's still running
      if (result.syncLogId) {
        setState({ phase: "running", syncLogId: result.syncLogId });

        // Poll for status updates
        const poll = setInterval(async () => {
          try {
            const status = await getSyncStatus(result.syncLogId!);
            if (!status) return;

            if (status.status === "completed") {
              clearInterval(poll);
              pollRef.current = null;
              setState({
                phase: "completed",
                stats: {
                  filesProcessed: status.filesProcessed,
                  added: 0,
                  modified: 0,
                  removed: 0,
                },
              });
            } else if (status.status === "failed") {
              clearInterval(poll);
              pollRef.current = null;
              setState({
                phase: "error",
                message: status.error ?? "Sync failed",
              });
            }
          } catch {
            // Ignore polling errors
          }
        }, 2000);

        pollRef.current = poll;

        // Also check immediately since runSync may have already completed
        const immediateStatus = await getSyncStatus(result.syncLogId);
        if (immediateStatus?.status === "completed") {
          clearInterval(poll);
          pollRef.current = null;
          setState({
            phase: "completed",
            stats: {
              filesProcessed: immediateStatus.filesProcessed,
              added: 0,
              modified: 0,
              removed: 0,
            },
          });
        } else if (immediateStatus?.status === "failed") {
          clearInterval(poll);
          pollRef.current = null;
          setState({
            phase: "error",
            message: immediateStatus.error ?? "Sync failed",
          });
        }
      }
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : "Sync failed",
      });
    }
  }, []);

  const isDisabled = disabled || state.phase === "starting" || state.phase === "running";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button onClick={handleSync} disabled={isDisabled}>
          {state.phase === "starting" || state.phase === "running" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {state.phase === "starting" ? "Starting..." : "Syncing..."}
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Manual Sync
            </>
          )}
        </Button>
      </div>

      {/* Result display */}
      {state.phase === "completed" && (
        <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
          <div className="text-sm text-green-800 dark:text-green-200">
            <p className="font-medium">Sync completed successfully</p>
            <p className="mt-1 text-green-700 dark:text-green-300">
              {state.stats.filesProcessed} file
              {state.stats.filesProcessed !== 1 ? "s" : ""} processed
            </p>
          </div>
        </div>
      )}

      {state.phase === "error" && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <div className="text-sm text-red-800 dark:text-red-200">
            <p className="font-medium">Sync failed</p>
            <p className="mt-1 text-red-700 dark:text-red-300">
              {state.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
