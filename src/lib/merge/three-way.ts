import { merge } from "node-diff3";

export interface MergeResult {
  mergedMarkdown: string;
  hasConflicts: boolean;
  conflictCount: number;
}

/**
 * Three-way merge for article content.
 *
 * Uses the diff3 algorithm to merge changes from two independently
 * modified versions of a common ancestor.
 *
 * @param base     - Last AI-generated version (common ancestor / "original")
 * @param current  - Current article content including human edits ("ours")
 * @param incoming - New AI-generated content ("theirs")
 * @returns MergeResult with merged content, conflict flag, and conflict count
 */
export function mergeArticleContent(
  base: string,
  current: string,
  incoming: string
): MergeResult {
  // node-diff3 merge(a, o, b) where a = ours, o = original, b = theirs
  const result = merge(
    current.split("\n"), // a = ours (human-edited version)
    base.split("\n"), // o = original (last AI version)
    incoming.split("\n"), // b = theirs (new AI version)
    { excludeFalseConflicts: true }
  );

  // Count conflict blocks by counting opening markers.
  // node-diff3 merge() inserts "<<<<<<<", "=======", ">>>>>>>" markers
  // for each conflict region.
  let conflictCount = 0;
  for (const line of result.result) {
    if (line.startsWith("<<<<<<<")) {
      conflictCount++;
    }
  }

  return {
    mergedMarkdown: result.result.join("\n"),
    hasConflicts: result.conflict,
    conflictCount,
  };
}
