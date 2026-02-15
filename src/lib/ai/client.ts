import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getSetting } from "@/lib/settings";
import { SETTING_KEYS, type SettingKey } from "@/lib/settings/constants";

const VALID_EFFORTS = new Set(["xhigh", "high", "medium", "low", "minimal", "none"]);

type ReasoningEffort = "xhigh" | "high" | "medium" | "low" | "minimal" | "none";

/**
 * Generic factory: create an OpenRouter model instance from per-prompt settings.
 *
 * Reads the API key from `openrouter_api_key`, the model name from `modelKey`,
 * and reasoning effort from `reasoningKey`. Throws if API key or model name
 * is missing.
 */
async function createModelFromSettings(
  modelKey: SettingKey,
  reasoningKey: SettingKey
) {
  const [apiKey, modelName, reasoningEffort] = await Promise.all([
    getSetting(SETTING_KEYS.openrouter_api_key),
    getSetting(modelKey),
    getSetting(reasoningKey),
  ]);

  if (!apiKey) {
    throw new Error(
      "OpenRouter API key not configured. Please set it in Admin > Settings."
    );
  }
  if (!modelName) {
    throw new Error(
      `Model not configured for setting "${modelKey}". Please set it in Admin > Settings > AI Prompts.`
    );
  }

  const openrouter = createOpenRouter({
    apiKey,
    headers: {
      "HTTP-Referer": "https://codewiki.internal",
      "X-Title": "CodeWiki",
    },
  });

  const effort = reasoningEffort?.trim().toLowerCase();
  const reasoning =
    effort && VALID_EFFORTS.has(effort) && effort !== "none"
      ? { effort: effort as ReasoningEffort }
      : undefined;

  return openrouter(modelName, { reasoning });
}

/** Model for code analysis (analyzeChanges). */
export function getAnalysisModel() {
  return createModelFromSettings(
    SETTING_KEYS.analysis_prompt_model,
    SETTING_KEYS.analysis_prompt_reasoning_effort
  );
}

/** Model for file summaries (generateFileSummaries). */
export function getFileSummaryModel() {
  return createModelFromSettings(
    SETTING_KEYS.file_summary_prompt_model,
    SETTING_KEYS.file_summary_prompt_reasoning_effort
  );
}

/** Model for global Ask AI chat. */
export function getAskAIGlobalModel() {
  return createModelFromSettings(
    SETTING_KEYS.ask_ai_global_prompt_model,
    SETTING_KEYS.ask_ai_global_prompt_reasoning_effort
  );
}

/** Model for page-level Ask AI chat. */
export function getAskAIPageModel() {
  return createModelFromSettings(
    SETTING_KEYS.ask_ai_page_prompt_model,
    SETTING_KEYS.ask_ai_page_prompt_reasoning_effort
  );
}
