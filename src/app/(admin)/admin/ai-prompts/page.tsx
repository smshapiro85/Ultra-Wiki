import { loadSettings } from "../settings/actions";
import { AiPromptsSettings } from "../settings/ai-prompts-settings";

export default async function AiPromptsPage() {
  const settings = await loadSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          AI Prompts
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Configure AI prompts and per-prompt model selection.
        </p>
      </div>

      <AiPromptsSettings settings={settings} />
    </div>
  );
}
