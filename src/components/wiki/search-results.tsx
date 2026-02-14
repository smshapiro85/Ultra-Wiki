import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export interface SearchResult {
  id: string;
  title: string;
  slug: string;
  categoryName: string | null;
  categorySlug: string | null;
  updatedAt: string;
  rank: number;
  headline: string;
}

/**
 * Sanitize headline HTML: strip all tags except <mark> and </mark>.
 * Prevents XSS from article content while preserving search highlighting.
 */
function sanitizeHeadline(html: string): string {
  return html.replace(/<(?!\/?mark\b)[^>]*>/gi, "");
}

/**
 * Search result list with highlighted snippets.
 * Server component -- no "use client" needed.
 */
export function SearchResults({ results }: { results: SearchResult[] }) {
  if (results.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        No results found. Try a different search term.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((result) => (
        <div
          key={result.id}
          className="rounded-lg border p-4 transition-colors hover:bg-accent/50"
        >
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/wiki/${result.slug}`}
              className="text-lg font-semibold hover:underline"
            >
              {result.title}
            </Link>
            {result.categoryName && (
              <Badge variant="outline" className="shrink-0">
                {result.categoryName}
              </Badge>
            )}
          </div>

          {result.headline && (
            <p
              className="mt-2 text-sm text-muted-foreground [&>mark]:bg-yellow-200 [&>mark]:text-foreground dark:[&>mark]:bg-yellow-800"
              dangerouslySetInnerHTML={{
                __html: sanitizeHeadline(result.headline),
              }}
            />
          )}

          <p className="mt-2 text-xs text-muted-foreground">
            Updated{" "}
            {new Date(result.updatedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      ))}
    </div>
  );
}
