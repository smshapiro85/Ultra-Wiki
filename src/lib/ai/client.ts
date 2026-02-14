import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/settings/constants";

const VALID_EFFORTS = new Set(["xhigh", "high", "medium", "low", "minimal", "none"]);

type ReasoningEffort = "xhigh" | "high" | "medium" | "low" | "minimal" | "none";

/**
 * Create an OpenRouter AI model instance using stored site settings.
 * Always creates a fresh instance so it picks up key/model changes.
 *
 * Reads reasoning effort from settings and passes it to the provider.
 */
export async function getAIModel() {
  const [apiKey, modelName, reasoningEffort] = await Promise.all([
    getSetting(SETTING_KEYS.openrouter_api_key),
    getSetting(SETTING_KEYS.openrouter_model),
    getSetting(SETTING_KEYS.openrouter_reasoning_effort),
  ]);

  if (!apiKey) {
    throw new Error(
      "OpenRouter API key not configured. Please set it in Admin > Settings."
    );
  }
  if (!modelName) {
    throw new Error(
      "OpenRouter model not configured. Please set it in Admin > Settings."
    );
  }

  const openrouter = createOpenRouter({
    apiKey,
    headers: {
      "HTTP-Referer": "https://codewiki.internal",
      "X-Title": "CodeWiki",
    },
  });

  // Build reasoning config if a valid effort is set
  const effort = reasoningEffort?.trim().toLowerCase();
  const reasoning = effort && VALID_EFFORTS.has(effort) && effort !== "none"
    ? { effort: effort as ReasoningEffort }
    : undefined;

  return openrouter(modelName, { reasoning });
}
