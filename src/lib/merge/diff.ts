import { createPatch } from "diff";

/**
 * Generate a unified diff between two versions of article content.
 *
 * Used for version history display -- stored alongside article versions
 * for quick diff rendering in the History tab.
 *
 * @param oldContent - The previous version content
 * @param newContent - The current version content
 * @param label     - A label for the diff (e.g. article slug or filename)
 * @returns A unified diff string with 3 lines of context
 */
export function generateUnifiedDiff(
  oldContent: string,
  newContent: string,
  label: string
): string {
  return createPatch(
    label,
    oldContent,
    newContent,
    "previous version",
    "current version",
    { context: 3 }
  );
}
