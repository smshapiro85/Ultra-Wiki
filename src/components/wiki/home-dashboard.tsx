import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bot, User, GitMerge, Sparkles } from "lucide-react";

interface RecentArticle {
  id: string;
  title: string;
  slug: string;
  categoryName: string | null;
  categorySlug: string | null;
  updatedAt: Date;
  changeSource: string | null;
}

interface BookmarkedArticle {
  id: string;
  title: string;
  slug: string;
  categoryName: string | null;
  categorySlug: string | null;
  bookmarkedAt: Date;
}

interface HomeDashboardProps {
  recentArticles: RecentArticle[];
  bookmarkedArticles: BookmarkedArticle[];
  userName: string | null;
}

/**
 * Map change source to a styled badge with icon.
 */
function ChangeSourceBadge({
  changeSource,
}: {
  changeSource: string | null;
}) {
  switch (changeSource) {
    case "ai_generated":
      return (
        <Badge variant="secondary" className="gap-1 text-xs">
          <Sparkles className="size-3" />
          AI Generated
        </Badge>
      );
    case "ai_updated":
      return (
        <Badge variant="secondary" className="gap-1 text-xs">
          <Bot className="size-3" />
          AI Updated
        </Badge>
      );
    case "human_edited":
      return (
        <Badge variant="outline" className="gap-1 text-xs">
          <User className="size-3" />
          Human Edited
        </Badge>
      );
    case "ai_merged":
      return (
        <Badge variant="outline" className="gap-1 text-xs">
          <GitMerge className="size-3" />
          AI Merged
        </Badge>
      );
    default:
      return null;
  }
}

/**
 * Home dashboard showing recent article updates and user bookmarks.
 * Server component -- no "use client" needed.
 *
 * Layout: Two-column grid on desktop (lg:grid-cols-2), single column on mobile.
 */
export function HomeDashboard({
  recentArticles,
  bookmarkedArticles,
  userName,
}: HomeDashboardProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Recent Updates */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Updates</CardTitle>
        </CardHeader>
        <CardContent>
          {recentArticles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No articles yet. Run a sync to generate content.
            </p>
          ) : (
            <div className="space-y-3">
              {recentArticles.map((article) => (
                <div
                  key={article.id}
                  className="flex items-start justify-between gap-2 rounded-md border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/wiki/${article.slug}`}
                      className="font-medium hover:underline"
                    >
                      {article.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {article.categoryName && (
                        <span className="text-xs text-muted-foreground">
                          {article.categoryName}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {article.updatedAt.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <ChangeSourceBadge changeSource={article.changeSource} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bookmarks */}
      <Card>
        <CardHeader>
          <CardTitle>Your Bookmarks</CardTitle>
        </CardHeader>
        <CardContent>
          {bookmarkedArticles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No bookmarks yet. Star articles to save them here.
            </p>
          ) : (
            <div className="space-y-3">
              {bookmarkedArticles.map((article) => (
                <div
                  key={article.id}
                  className="rounded-md border p-3"
                >
                  <Link
                    href={`/wiki/${article.slug}`}
                    className="font-medium hover:underline"
                  >
                    {article.title}
                  </Link>
                  <div className="mt-1 flex items-center gap-2">
                    {article.categoryName && (
                      <span className="text-xs text-muted-foreground">
                        {article.categoryName}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Bookmarked{" "}
                      {article.bookmarkedAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
