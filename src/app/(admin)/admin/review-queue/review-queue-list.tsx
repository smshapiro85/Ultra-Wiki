"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import type { ReviewQueueItem } from "@/lib/wiki/queries";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
  }
  if (diffHours > 0) {
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  }
  if (diffMinutes > 0) {
    return diffMinutes === 1 ? "1 minute ago" : `${diffMinutes} minutes ago`;
  }
  return "just now";
}

type SortOrder = "newest" | "oldest";

export function ReviewQueueList({ items }: { items: ReviewQueueItem[] }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const uniqueCategories = useMemo(() => {
    const names = new Set<string>();
    for (const item of items) {
      if (item.categoryName) {
        names.add(item.categoryName);
      }
    }
    return Array.from(names).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((item) => item.title.toLowerCase().includes(q));
    }

    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter((item) => item.categoryName === categoryFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });

    return result;
  }, [items, search, categoryFilter, sortOrder]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by article title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm text-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
        >
          <option value="all">All Categories</option>
          {uniqueCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          className="h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm text-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
      </div>

      {/* Item list */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No articles need review.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <Card key={item.id} className="py-0">
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/wiki/${item.slug}`}
                    className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    {item.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {item.categoryName && (
                      <Badge variant="outline" className="text-xs">
                        {item.categoryName}
                      </Badge>
                    )}
                    {item.needsReview && (
                      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                        Needs Review
                      </Badge>
                    )}
                    {item.annotationCount > 0 && (
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {item.annotationCount}{" "}
                        {item.annotationCount === 1
                          ? "Annotation"
                          : "Annotations"}
                      </Badge>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  {relativeTime(item.updatedAt)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
