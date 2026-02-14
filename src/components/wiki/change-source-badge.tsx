"use client";

import {
  Sparkles,
  Bot,
  User,
  GitMerge,
  FileEdit,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ChangeSourceBadge({
  changeSource,
}: {
  changeSource: string;
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
    case "draft":
      return (
        <Badge
          variant="outline"
          className="gap-1 text-xs border-dashed text-muted-foreground"
        >
          <FileEdit className="size-3" />
          Draft
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1 text-xs">
          {changeSource}
        </Badge>
      );
  }
}
