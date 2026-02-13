import { ServerBlockNoteEditor } from "@blocknote/server-util";

// Lazy singleton -- created once and reused across requests.
// ServerBlockNoteEditor.create() is synchronous but we keep the
// getter async-compatible for consistency with the async methods.
let editorInstance: ServerBlockNoteEditor | null = null;

function getServerEditor(): ServerBlockNoteEditor {
  if (!editorInstance) {
    editorInstance = ServerBlockNoteEditor.create();
  }
  return editorInstance;
}

/**
 * Convert BlockNote JSON blocks to Markdown for AI processing.
 *
 * This is a LOSSY conversion -- some block types and inline styles
 * may lose attributes. Acceptable for AI consumption and diffs.
 *
 * @param blocksJson - BlockNote block array (typed as unknown for flexibility)
 * @returns Markdown string
 */
export async function blocksToMarkdown(
  blocksJson: unknown
): Promise<string> {
  const editor = getServerEditor();
  // Cast to the expected PartialBlock[] type used by the editor
  const blocks = blocksJson as Parameters<
    typeof editor.blocksToMarkdownLossy
  >[0];
  return await editor.blocksToMarkdownLossy(blocks);
}

/**
 * Convert Markdown (from AI generation or merge) to BlockNote JSON blocks.
 *
 * Used to convert AI-generated Markdown into the native BlockNote JSON
 * format for storage in the contentJson column.
 *
 * @param markdown - Markdown string to parse
 * @returns Array of BlockNote JSON blocks
 */
export async function markdownToBlocks(
  markdown: string
): Promise<unknown[]> {
  const editor = getServerEditor();
  return await editor.tryParseMarkdownToBlocks(markdown);
}
