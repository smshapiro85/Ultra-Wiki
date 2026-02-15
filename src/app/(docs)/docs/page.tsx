import fs from "fs";
import path from "path";
import { DocsViewer } from "./docs-viewer";

interface DocFile {
  slug: string;
  title: string;
  content: string;
}

function loadDocs(): DocFile[] {
  const docsDir = path.join(process.cwd(), "docs");

  if (!fs.existsSync(docsDir)) return [];

  const files = fs
    .readdirSync(docsDir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  return files.map((filename) => {
    const content = fs.readFileSync(path.join(docsDir, filename), "utf-8");
    const slug = filename.replace(/\.md$/, "");

    // Extract title from first H1 line, or fall back to filename
    const firstLine = content.split("\n").find((l) => l.startsWith("# "));
    const title = firstLine ? firstLine.replace(/^#\s+/, "") : slug;

    return { slug, title, content };
  });
}

export const dynamic = "force-dynamic";

export default function DocsPage() {
  const docs = loadDocs();

  return (
    <div className="max-w-[1150px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Documentation
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Reference documentation for Ultra Wiki.
        </p>
      </div>

      {docs.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No documentation files found. Add <code>.md</code> files to the{" "}
          <code>/docs</code> folder to see them here.
        </p>
      ) : (
        <DocsViewer docs={docs} />
      )}
    </div>
  );
}
