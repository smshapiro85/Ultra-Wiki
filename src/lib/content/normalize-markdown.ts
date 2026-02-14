import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import type { Root } from "mdast";
import { visit } from "unist-util-visit";

/**
 * Remark plugin that forces all lists to "tight" format (no blank lines
 * between items). BlockNote's blocksToMarkdownLossy always produces loose
 * lists (blank line between every item), while AI-generated markdown uses
 * tight lists. Normalizing to tight ensures diffs only show real changes.
 */
function remarkTightLists() {
  return (tree: Root) => {
    visit(tree, (node) => {
      if (node.type === "list" || node.type === "listItem") {
        (node as any).spread = false;
      }
    });
  };
}

/**
 * Normalize markdown through a consistent AST round-trip.
 *
 * Both the AI pipeline and the BlockNote editor produce markdown, but with
 * different formatting (whitespace, list markers, line breaks, list spacing).
 * Running both through the same remark parse → stringify pipeline ensures
 * identical formatting for the same semantic content, so diffs only show
 * real content changes.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkTightLists)
  .use(remarkStringify, {
    bullet: "-",
    listItemIndent: "one",
    rule: "-",
  });

export function normalizeMarkdown(markdown: string): string {
  if (!markdown) return markdown;
  const file = processor.processSync(markdown);
  // Trim trailing blank lines and ensure a single trailing newline.
  return String(file).trimEnd() + "\n";
}
