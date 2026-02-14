"use client";

import { useState, useMemo } from "react";
import { diffLines, type Change } from "diff";
import { Button } from "@/components/ui/button";

interface DiffViewerProps {
  oldContent: string;
  newContent: string;
  oldLabel: string;
  newLabel: string;
}

/**
 * Custom diff viewer component that renders line-level diffs
 * in either inline or side-by-side mode.
 *
 * Uses the `diff` library (v8) to compute line differences.
 * Additions are shown in green, removals in red, unchanged in neutral.
 */
export function DiffViewer({
  oldContent,
  newContent,
  oldLabel,
  newLabel,
}: DiffViewerProps) {
  const [mode, setMode] = useState<"inline" | "side-by-side">("inline");

  const changes = useMemo(
    () => diffLines(oldContent, newContent),
    [oldContent, newContent]
  );

  if (oldContent === newContent) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        No changes between these versions.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      {/* Mode toggle */}
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <span className="text-sm font-medium text-muted-foreground mr-2">
          View:
        </span>
        <Button
          variant={mode === "inline" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("inline")}
        >
          Inline
        </Button>
        <Button
          variant={mode === "side-by-side" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("side-by-side")}
        >
          Side by Side
        </Button>
      </div>

      {mode === "inline" ? (
        <InlineDiff changes={changes} oldLabel={oldLabel} newLabel={newLabel} />
      ) : (
        <SideBySideDiff
          changes={changes}
          oldLabel={oldLabel}
          newLabel={newLabel}
        />
      )}
    </div>
  );
}

// =============================================================================
// Inline Diff
// =============================================================================

function InlineDiff({
  changes,
  oldLabel,
  newLabel,
}: {
  changes: Change[];
  oldLabel: string;
  newLabel: string;
}) {
  let oldLine = 1;
  let newLine = 1;

  return (
    <div className="overflow-x-auto">
      {/* Labels */}
      <div className="flex gap-4 border-b px-4 py-1.5 text-xs text-muted-foreground">
        <span>
          <span className="text-red-600 dark:text-red-400">---</span>{" "}
          {oldLabel}
        </span>
        <span>
          <span className="text-green-600 dark:text-green-400">+++</span>{" "}
          {newLabel}
        </span>
      </div>
      <div className="font-mono text-sm">
        {changes.map((change, i) => {
          const lines = change.value.replace(/\n$/, "").split("\n");
          const elements = lines.map((line, j) => {
            if (change.added) {
              const lineNum = newLine++;
              return (
                <div
                  key={`${i}-${j}`}
                  className="flex bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"
                >
                  <span className="w-10 shrink-0 select-none border-r px-1 text-right text-xs leading-6 text-muted-foreground/50">
                    &nbsp;
                  </span>
                  <span className="w-10 shrink-0 select-none border-r px-1 text-right text-xs leading-6 text-green-600 dark:text-green-400">
                    {lineNum}
                  </span>
                  <span className="whitespace-pre-wrap px-4 py-0.5 leading-6">
                    +{line}
                  </span>
                </div>
              );
            } else if (change.removed) {
              const lineNum = oldLine++;
              return (
                <div
                  key={`${i}-${j}`}
                  className="flex bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
                >
                  <span className="w-10 shrink-0 select-none border-r px-1 text-right text-xs leading-6 text-red-600 dark:text-red-400">
                    {lineNum}
                  </span>
                  <span className="w-10 shrink-0 select-none border-r px-1 text-right text-xs leading-6 text-muted-foreground/50">
                    &nbsp;
                  </span>
                  <span className="whitespace-pre-wrap px-4 py-0.5 leading-6">
                    -{line}
                  </span>
                </div>
              );
            } else {
              const oldNum = oldLine++;
              const newNum = newLine++;
              return (
                <div
                  key={`${i}-${j}`}
                  className="flex text-muted-foreground"
                >
                  <span className="w-10 shrink-0 select-none border-r px-1 text-right text-xs leading-6 text-muted-foreground/50">
                    {oldNum}
                  </span>
                  <span className="w-10 shrink-0 select-none border-r px-1 text-right text-xs leading-6 text-muted-foreground/50">
                    {newNum}
                  </span>
                  <span className="whitespace-pre-wrap px-4 py-0.5 leading-6">
                    {" "}
                    {line}
                  </span>
                </div>
              );
            }
          });
          return elements;
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Side-by-Side Diff
// =============================================================================

interface SideLine {
  content: string;
  type: "added" | "removed" | "unchanged" | "empty";
  lineNum: number | null;
}

function SideBySideDiff({
  changes,
  oldLabel,
  newLabel,
}: {
  changes: Change[];
  oldLabel: string;
  newLabel: string;
}) {
  // Build left (old) and right (new) lines with alignment
  const leftLines: SideLine[] = [];
  const rightLines: SideLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const change of changes) {
    const lines = change.value.replace(/\n$/, "").split("\n");

    if (change.removed) {
      for (const line of lines) {
        leftLines.push({ content: line, type: "removed", lineNum: oldLine++ });
        rightLines.push({ content: "", type: "empty", lineNum: null });
      }
    } else if (change.added) {
      // Check if there are empty slots on the right from previous removals
      // to fill in for alignment
      let filled = 0;
      for (let i = rightLines.length - 1; i >= 0 && filled < lines.length; i--) {
        if (rightLines[i].type === "empty") {
          rightLines[i] = {
            content: lines[filled],
            type: "added",
            lineNum: newLine++,
          };
          filled++;
        } else {
          break;
        }
      }
      // Any remaining additions go as new rows
      for (let i = filled; i < lines.length; i++) {
        leftLines.push({ content: "", type: "empty", lineNum: null });
        rightLines.push({
          content: lines[i],
          type: "added",
          lineNum: newLine++,
        });
      }
    } else {
      for (const line of lines) {
        leftLines.push({
          content: line,
          type: "unchanged",
          lineNum: oldLine++,
        });
        rightLines.push({
          content: line,
          type: "unchanged",
          lineNum: newLine++,
        });
      }
    }
  }

  return (
    <div className="flex overflow-x-auto">
      {/* Left (old) */}
      <div className="flex-1 min-w-0 border-r">
        <div className="border-b px-3 py-1.5 text-xs font-medium text-muted-foreground truncate">
          {oldLabel}
        </div>
        <div className="font-mono text-sm">
          {leftLines.map((line, i) => (
            <SideLineRow key={i} line={line} side="left" />
          ))}
        </div>
      </div>
      {/* Right (new) */}
      <div className="flex-1 min-w-0">
        <div className="border-b px-3 py-1.5 text-xs font-medium text-muted-foreground truncate">
          {newLabel}
        </div>
        <div className="font-mono text-sm">
          {rightLines.map((line, i) => (
            <SideLineRow key={i} line={line} side="right" />
          ))}
        </div>
      </div>
    </div>
  );
}

function SideLineRow({ line }: { line: SideLine; side: "left" | "right" }) {
  const bgClass =
    line.type === "added"
      ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"
      : line.type === "removed"
        ? "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
        : line.type === "empty"
          ? "bg-muted/30"
          : "text-muted-foreground";

  return (
    <div className={`flex ${bgClass}`}>
      <span className="w-10 shrink-0 select-none border-r px-1 text-right text-xs leading-6 text-muted-foreground/50">
        {line.lineNum ?? ""}
      </span>
      <span className="whitespace-pre-wrap px-3 py-0.5 leading-6 min-w-0">
        {line.type === "added" && "+"}
        {line.type === "removed" && "-"}
        {line.type === "unchanged" && " "}
        {line.content}
      </span>
    </div>
  );
}
