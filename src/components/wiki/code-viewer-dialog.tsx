"use client";

import { useState, useEffect } from "react";
import { ExternalLink, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface CodeViewerDialogProps {
  filePath: string;
  githubUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; html: string; lang: string }
  | { status: "too-large" }
  | { status: "error"; message: string };

/**
 * Dialog that displays syntax-highlighted file content fetched from GitHub
 * via the /api/github/file-content endpoint. Shows loading skeleton while
 * fetching, graceful handling for too-large files, and error retry.
 */
export function CodeViewerDialog({
  filePath,
  githubUrl,
  open,
  onOpenChange,
}: CodeViewerDialogProps) {
  const [state, setState] = useState<FetchState>({ status: "idle" });

  useEffect(() => {
    if (!open) {
      setState({ status: "idle" });
      return;
    }

    fetchContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filePath]);

  async function fetchContent() {
    setState({ status: "loading" });

    try {
      const res = await fetch(
        `/api/github/file-content?path=${encodeURIComponent(filePath)}`
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setState({
          status: "error",
          message: data.error || `HTTP ${res.status}`,
        });
        return;
      }

      const data = await res.json();

      if (data.tooLarge) {
        setState({ status: "too-large" });
        return;
      }

      setState({ status: "success", html: data.html, lang: data.lang });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to fetch file",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm truncate pr-8">
            {filePath}
          </DialogTitle>
          {state.status === "success" && (
            <DialogDescription>Language: {state.lang}</DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0">
          {state.status === "loading" && (
            <div className="space-y-2 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          )}

          {state.status === "success" && (
            <div
              className="overflow-auto text-sm [&_pre]:!rounded-none [&_pre]:!m-0"
              dangerouslySetInnerHTML={{ __html: state.html }}
            />
          )}

          {state.status === "too-large" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <p className="text-muted-foreground">
                This file is too large for inline viewing.
              </p>
              <Button variant="outline" asChild>
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="size-4" />
                  View on GitHub
                </a>
              </Button>
            </div>
          )}

          {state.status === "error" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <p className="text-destructive">{state.message}</p>
              <Button variant="outline" onClick={fetchContent}>
                <RotateCcw className="size-4" />
                Retry
              </Button>
            </div>
          )}
        </div>

        <DialogFooter showCloseButton>
          <Button variant="outline" size="sm" asChild>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-4" />
              Open on GitHub
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
