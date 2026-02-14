import { getReviewQueueItems } from "@/lib/wiki/queries";
import { Badge } from "@/components/ui/badge";
import { ReviewQueueList } from "./review-queue-list";

export default async function ReviewQueuePage() {
  const items = await getReviewQueueItems();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Review Queue
        </h1>
        <Badge variant="secondary" className="text-sm">
          {items.length}
        </Badge>
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Articles with merge conflicts or active AI review annotations needing
        attention.
      </p>

      <ReviewQueueList items={items} />
    </div>
  );
}
