"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { saveAiPrompts } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AiPromptsSettingsProps {
  settings: Record<string, { value: string; isSecret: boolean }>;
}

const REASONING_OPTIONS = [
  { value: "none", label: "None (disabled)" },
  { value: "minimal", label: "Minimal (~10% of tokens)" },
  { value: "low", label: "Low (~20% of tokens)" },
  { value: "medium", label: "Medium (~50% of tokens)" },
  { value: "high", label: "High (~80% of tokens)" },
  { value: "xhigh", label: "Extra High (~95% of tokens)" },
];

function ModelFields({
  modelKey,
  reasoningKey,
  settings,
  modelPlaceholder,
}: {
  modelKey: string;
  reasoningKey: string;
  settings: Record<string, { value: string; isSecret: boolean }>;
  modelPlaceholder?: string;
}) {
  return (
    <div className="mt-3 space-y-3 border-l-2 border-zinc-200 pl-4 dark:border-zinc-700">
      <div className="space-y-1">
        <Label htmlFor={modelKey} className="text-xs">
          Model
        </Label>
        <Input
          id={modelKey}
          name={modelKey}
          type="text"
          defaultValue={settings[modelKey]?.value ?? ""}
          placeholder={modelPlaceholder ?? "anthropic/claude-sonnet-4-20250514"}
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={reasoningKey} className="text-xs">
          Reasoning Effort
        </Label>
        <select
          id={reasoningKey}
          name={reasoningKey}
          defaultValue={settings[reasoningKey]?.value ?? "none"}
          className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {REASONING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
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
              defaultValue={settings.analysis_prompt?.value || ""}
              placeholder="System prompt for analyzing code files..."
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Used when AI analyzes repository code files to understand their
              purpose and relationships.
            </p>
            <ModelFields
              modelKey="analysis_prompt_model"
              reasoningKey="analysis_prompt_reasoning_effort"
              settings={settings}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="article_style_prompt">Article Style Prompt</Label>
            <Textarea
              id="article_style_prompt"
              name="article_style_prompt"
              rows={12}
              defaultValue={settings.article_style_prompt?.value || ""}
              placeholder="System prompt for writing article content..."
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Controls the writing style and format of AI-generated wiki
              articles. Uses the same model as the Code Analysis prompt above.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file_summary_prompt">File Summary Prompt</Label>
            <Textarea
              id="file_summary_prompt"
              name="file_summary_prompt"
              rows={4}
              defaultValue={settings.file_summary_prompt?.value || ""}
              placeholder="Prompt for generating 1-2 sentence file descriptions..."
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Controls how AI generates short descriptions for source files.
              Used in the Technical View file cards.
            </p>
            <ModelFields
              modelKey="file_summary_prompt_model"
              reasoningKey="file_summary_prompt_reasoning_effort"
              settings={settings}
              modelPlaceholder="google/gemini-2.0-flash-001"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ask_ai_global_prompt">
              Global Ask AI Prompt
            </Label>
            <Textarea
              id="ask_ai_global_prompt"
              name="ask_ai_global_prompt"
              rows={12}
              defaultValue={settings.ask_ai_global_prompt?.value || ""}
              placeholder="System prompt for global AI chat..."
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              System prompt for the global Ask AI feature, which answers
              questions across the entire wiki.
            </p>
            <ModelFields
              modelKey="ask_ai_global_prompt_model"
              reasoningKey="ask_ai_global_prompt_reasoning_effort"
              settings={settings}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ask_ai_page_prompt">
              Page-level Ask AI Prompt
            </Label>
            <Textarea
              id="ask_ai_page_prompt"
              name="ask_ai_page_prompt"
              rows={12}
              defaultValue={settings.ask_ai_page_prompt?.value || ""}
              placeholder="System prompt for page-level AI chat..."
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              System prompt for per-article Ask AI, which answers questions in
              the context of a specific article.
            </p>
            <ModelFields
              modelKey="ask_ai_page_prompt_model"
              reasoningKey="ask_ai_page_prompt_reasoning_effort"
              settings={settings}
            />
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save AI Prompts"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
