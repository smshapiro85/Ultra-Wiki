"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

interface DocFile {
  slug: string;
  title: string;
  content: string;
}

export function DocsViewer({ docs }: { docs: DocFile[] }) {
  const [activeSlug, setActiveSlug] = useState(docs[0]?.slug ?? "");
  const activeDoc = docs.find((d) => d.slug === activeSlug);

  return (
    <div className="flex gap-6 min-h-[60vh]">
      {/* Sidebar index */}
      <nav className="w-56 shrink-0 space-y-1">
        {docs.map((doc) => (
          <button
            key={doc.slug}
            onClick={() => setActiveSlug(doc.slug)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
              doc.slug === activeSlug
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <FileText className="size-4 shrink-0" />
            <span className="truncate">{doc.title}</span>
          </button>
        ))}
      </nav>

      {/* Document content */}
      <article className="min-w-0 flex-1 rounded-lg border bg-card p-8">
        {activeDoc ? (
          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {activeDoc.content}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a document from the sidebar.
          </p>
        )}
      </article>
    </div>
  );
}
