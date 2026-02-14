import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { getRecentArticles, getUserBookmarks } from "@/lib/wiki/queries";
import { HomeDashboard } from "@/components/wiki/home-dashboard";
import { SearchInput } from "@/components/wiki/search-input";
import { Skeleton } from "@/components/ui/skeleton";

export default async function HomePage() {
  const session = await auth();

  // Layout already redirects if not logged in, but guard for type safety
  if (!session?.user?.id) {
    return null;
  }

  const [recentArticles, bookmarks] = await Promise.all([
    getRecentArticles(10),
    getUserBookmarks(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      <Suspense fallback={<Skeleton className="h-9 w-full max-w-md" />}>
        <div className="max-w-md">
          <SearchInput />
        </div>
      </Suspense>

      <HomeDashboard
        recentArticles={recentArticles}
        bookmarkedArticles={bookmarks}
        userName={session.user.name ?? null}
      />
    </div>
  );
}
