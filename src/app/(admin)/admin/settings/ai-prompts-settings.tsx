"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { saveAiPrompts } from "./actions";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DEFAULT_ANALYSIS_PROMPT,
  DEFAULT_ARTICLE_STYLE_PROMPT,
  DEFAULT_FILE_SUMMARY_PROMPT,
} from "@/lib/ai/prompts";

interface AiPromptsSettingsProps {
  settings: Record<string, { value: string; isSecret: boolean }>;
}

export function AiPromptsSettings({ settings }: AiPromptsSettingsProps) {
  const [state, formAction, isPending] = useActionState(saveAiPrompts, null);

  useEffect(() => {
    if (state?.success) {
      toast.success("AI prompts saved");
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Prompts</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="analysis_prompt">Code Analysis Prompt</Label>
            <Textarea
              id="analysis_prompt"
              name="analysis_prompt"
              rows={12}
              defaultValue={settings.analysis_prompt?.value || DEFAULT_ANALYSIS_PROMPT}
              placeholder="System prompt for analyzing code files..."
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Used when AI analyzes repository code files to understand their
              purpose and relationships.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="article_style_prompt">Article Style Prompt</Label>
            <Textarea
              id="article_style_prompt"
              name="article_style_prompt"
              rows={12}
              defaultValue={settings.article_style_prompt?.value || DEFAULT_ARTICLE_STYLE_PROMPT}
              placeholder="System prompt for writing article content..."
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Controls the writing style and format of AI-generated wiki
              articles.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file_summary_prompt">File Summary Prompt</Label>
            <Textarea
              id="file_summary_prompt"
              name="file_summary_prompt"
              rows={4}
              defaultValue={settings.file_summary_prompt?.value || DEFAULT_FILE_SUMMARY_PROMPT}
              placeholder="Prompt for generating 1-2 sentence file descriptions..."
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Controls how AI generates short descriptions for source files.
              Used in the Technical View file cards.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ask_ai_global_prompt">
              Global Ask AI Prompt
            </Label>
            <Textarea
              id="ask_ai_global_prompt"
              name="ask_ai_global_prompt"
              rows={6}
              defaultValue={settings.ask_ai_global_prompt?.value ?? ""}
              placeholder="System prompt for global AI chat..."
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              System prompt for the global Ask AI feature, which answers
              questions across the entire wiki.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ask_ai_page_prompt">
              Page-level Ask AI Prompt
            </Label>
            <Textarea
              id="ask_ai_page_prompt"
              name="ask_ai_page_prompt"
              rows={6}
              defaultValue={settings.ask_ai_page_prompt?.value ?? ""}
              placeholder="System prompt for page-level AI chat..."
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              System prompt for per-article Ask AI, which answers questions in
              the context of a specific article.
            </p>
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save AI Prompts"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
