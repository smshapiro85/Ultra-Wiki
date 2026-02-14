"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Loader2, Play, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type SyncPhase = "idle" | "running" | "completed" | "error";

interface SyncTriggerProps {
  disabled?: boolean;
}

export function SyncTrigger({ disabled }: SyncTriggerProps) {
  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<EventSource | null>(null);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      sourceRef.current?.close();
    };
  }, []);

  // Auto-scroll log panel
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleSync = useCallback(() => {
    setPhase("running");
    setLogs([]);
    setErrorMessage("");

    const source = new EventSource("/api/sync/stream");
    sourceRef.current = source;

    source.addEventListener("log", (e) => {
      setLogs((prev) => [...prev, e.data]);
    });

    source.addEventListener("done", () => {
      source.close();
      sourceRef.current = null;
      setPhase("completed");
    });

    source.addEventListener("error", (e) => {
      source.close();
      sourceRef.current = null;
      const message = (e as MessageEvent)?.data || "Sync failed";
      setErrorMessage(message);
      setPhase("error");
    });
  }, []);

  const isDisabled = disabled || phase === "running";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button onClick={handleSync} disabled={isDisabled}>
          {phase === "running" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Manual Sync
            </>
          )}
        </Button>
      </div>

      {/* Live log panel */}
      {(phase === "running" || logs.length > 0) && (
        <div className="rounded-md border border-zinc-200 bg-zinc-950 p-3 font-mono text-xs text-zinc-300 max-h-64 overflow-y-auto dark:border-zinc-700">
          {logs.map((log, i) => (
            <div key={i} className="py-0.5">
              <span className="text-zinc-500 mr-2">
                {String(i + 1).padStart(2, "0")}
              </span>
              {log}
            </div>
          ))}
          {phase === "running" && (
            <div className="py-0.5 animate-pulse text-zinc-500">...</div>
          )}
          <div ref={logEndRef} />
        </div>
      )}

      {/* Result display */}
      {phase === "completed" && (
        <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
          <div className="text-sm text-green-800 dark:text-green-200">
            <p className="font-medium">Sync completed successfully</p>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <div className="text-sm text-red-800 dark:text-red-200">
            <p className="font-medium">Sync failed</p>
            {errorMessage && (
              <p className="mt-1 text-red-700 dark:text-red-300">
                {errorMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
