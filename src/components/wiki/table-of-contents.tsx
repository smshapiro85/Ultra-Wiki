export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

/**
 * Slugify a heading text to produce a URL-safe anchor ID.
 * Matches the IDs generated on heading elements in article-content.tsx.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Extract a table of contents from Markdown source by finding headings.
 * Returns an array of TocEntry with id, text, and heading level.
 */
export function extractToc(markdown: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const regex = /^(#{1,3})\s+(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    entries.push({
      id: slugify(text),
      text,
      level,
    });
  }

  return entries;
}

/**
 * Sticky table of contents sidebar generated from article headings.
 * Server component -- no "use client" needed.
 */
export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <nav className="sticky top-20">
      <h3 className="mb-3 text-sm font-semibold">On this page</h3>
      <ul className="space-y-1">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              style={{ paddingLeft: `${(entry.level - 1) * 12}px` }}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
