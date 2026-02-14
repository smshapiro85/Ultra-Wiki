import { Suspense } from "react";
import { searchArticles } from "@/lib/wiki/queries";
import { SearchInput } from "@/components/wiki/search-input";
import { SearchResults } from "@/components/wiki/search-results";
import { Skeleton } from "@/components/ui/skeleton";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = query ? await searchArticles(query) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {query ? "Search Results" : "Search"}
        </h1>
      </div>

      <Suspense fallback={<Skeleton className="h-9 w-full" />}>
        <SearchInput />
      </Suspense>

      {query ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Found {results.length} article{results.length !== 1 ? "s" : ""} for
            &ldquo;{query}&rdquo;
          </p>
          <SearchResults results={results} />
        </div>
      ) : (
        <p className="py-8 text-center text-muted-foreground">
          Enter a search term to find articles.
        </p>
      )}
    </div>
  );
}
