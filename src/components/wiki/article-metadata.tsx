import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Clock, User, Bot } from "lucide-react";

interface ArticleMetadataProps {
  updatedAt: Date;
  lastAiGeneratedAt: Date | null;
  lastHumanEditedAt: Date | null;
  lastEditorName: string | null;
  lastEditorImage: string | null;
  hasHumanEdits: boolean;
  categoryName: string;
  categorySlug: string;
}

/**
 * Compact horizontal metadata bar displayed below the article title.
 * Shows category, last updated, source badge, and editor name in a single row.
 */
export function ArticleMetadata({
  updatedAt,
  lastEditorName,
  lastEditorImage,
  hasHumanEdits,
  categoryName,
}: ArticleMetadataProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <Badge variant="secondary">{categoryName}</Badge>

      <Separator orientation="vertical" className="!h-4" />

      <span className="inline-flex items-center gap-1.5">
        <Clock className="size-3.5" />
        <time dateTime={updatedAt.toISOString()}>
          {updatedAt.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </time>
      </span>

      <Separator orientation="vertical" className="!h-4" />

      {hasHumanEdits ? (
        <Badge variant="outline" className="gap-1">
          <User className="size-3" />
          Human edited
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1">
          <Bot className="size-3" />
          AI generated
        </Badge>
      )}

      {lastEditorName && (
        <>
          <Separator orientation="vertical" className="!h-4" />
          <span className="inline-flex items-center gap-1.5">
            <Avatar size="sm" className="size-5">
              {lastEditorImage ? (
                <AvatarImage src={lastEditorImage} alt={lastEditorName} />
              ) : null}
              <AvatarFallback className="text-[10px]">
                {lastEditorName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {lastEditorName}
          </span>
        </>
      )}
    </div>
  );
}
