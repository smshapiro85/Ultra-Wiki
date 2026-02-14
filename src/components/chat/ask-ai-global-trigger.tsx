"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AskAiPanel } from "./ask-ai-panel";

export function AskAiGlobalTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline">Ask AI</span>
      </Button>
      <AskAiPanel
        open={open}
        onOpenChange={setOpen}
        endpoint="/api/chat"
        title="Ask AI"
      />
    </>
  );
}
