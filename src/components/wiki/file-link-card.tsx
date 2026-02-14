"use client";

import { useState } from "react";
import { FileCode, ExternalLink, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import { CodeViewerDialog } from "./code-viewer-dialog";

interface FileLinkCardProps {
  filePath: string;
  relevanceExplanation: string | null;
  aiSummary: string | null;
  githubUrl: string;
}

/**
 * Card for a single linked source file. Shows the file path, relevance
 * explanation, and provides "View Code" (opens dialog) and "Open on GitHub"
 * (external link) actions.
 */
export function FileLinkCard({
  filePath,
  relevanceExplanation,
  aiSummary,
  githubUrl,
}: FileLinkCardProps) {
  const [codeViewerOpen, setCodeViewerOpen] = useState(false);

  return (
    <>
      <Card className="py-4">
        <CardHeader className="overflow-hidden">
          <CardTitle className="flex items-center gap-2 text-sm font-mono min-w-0">
            <FileCode className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{filePath}</span>
          </CardTitle>
          {aiSummary && (
            <CardDescription className="text-sm line-clamp-2">
              {aiSummary}
            </CardDescription>
          )}
          {relevanceExplanation && (
            <CardDescription className="line-clamp-2">
              {relevanceExplanation}
            </CardDescription>
          )}
          <CardAction>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCodeViewerOpen(true)}
              >
                <Eye className="size-4" />
                View Code
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="size-4" />
                  GitHub
                </a>
              </Button>
            </div>
          </CardAction>
        </CardHeader>
      </Card>

      <CodeViewerDialog
        filePath={filePath}
        githubUrl={githubUrl}
        open={codeViewerOpen}
        onOpenChange={setCodeViewerOpen}
      />
    </>
  );
}
