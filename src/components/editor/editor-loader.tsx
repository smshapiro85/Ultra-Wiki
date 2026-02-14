"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton shown while the BlockNote editor loads.
 */
function EditorSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/**
 * Dynamic import of the BlockNote editor with SSR disabled.
 * This must be in a client component because Next.js 16 does not
 * allow ssr: false in server components.
 */
const DynamicEditor = dynamic(
  () =>
    import("@/components/editor/article-editor").then((m) => ({
      default: m.ArticleEditor,
    })),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

interface EditorLoaderProps {
  articleId: string;
  articleSlug: string;
  initialContentJson: unknown | null;
  initialContentMarkdown: string;
  articleUpdatedAt: string;
}

/**
 * Client component wrapper that dynamically loads the BlockNote editor.
 * Used by the server-side edit page to avoid SSR issues with BlockNote.
 */
export function EditorLoader(props: EditorLoaderProps) {
  return <DynamicEditor {...props} />;
}
