import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/settings/constants";

/**
 * Create an OpenRouter AI model instance using stored site settings.
 * Always creates a fresh instance so it picks up key/model changes.
 *
 * Uses the Vercel AI SDK provider pattern:
 *   createOpenRouter({ apiKey }) => provider(modelName) => LanguageModel
 */
export async function getAIModel() {
  const apiKey = await getSetting(SETTING_KEYS.openrouter_api_key);
  const modelName = await getSetting(SETTING_KEYS.openrouter_model);

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

  return openrouter(modelName);
}
