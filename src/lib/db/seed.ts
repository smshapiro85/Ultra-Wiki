import "dotenv/config";
import { eq, and, sql } from "drizzle-orm";
import { db } from "./index";
import { siteSettings } from "./schema";
import {
  DEFAULT_ANALYSIS_PROMPT,
  DEFAULT_ARTICLE_STYLE_PROMPT,
  DEFAULT_FILE_SUMMARY_PROMPT,
  DEFAULT_ASK_AI_GLOBAL_PROMPT,
  DEFAULT_ASK_AI_PAGE_PROMPT,
} from "../ai/prompts";

const requiredSettings = [
  { key: "github_repo_url", description: "Full GitHub repository URL", isSecret: false },
  { key: "github_branch", description: "GitHub branch to sync", value: "main", isSecret: false },
  { key: "github_api_key", description: "GitHub Personal Access Token", isSecret: true },
  { key: "openrouter_api_key", description: "OpenRouter API key", isSecret: true },
  {
    key: "openrouter_model",
    description: "OpenRouter model name",
    value: "anthropic/claude-sonnet-4-20250514",
    isSecret: false,
  },
  {
    key: "openrouter_reasoning_effort",
    description: "Reasoning effort level for thinking-capable models",
    value: "none",
    isSecret: false,
  },
  {
    key: "sync_cron_schedule",
    description: "Cron expression for scheduled sync",
    value: "0 9 * * 6",
    isSecret: false,
  },
  { key: "sendgrid_api_key", description: "SendGrid API key", isSecret: true },
  { key: "sendgrid_from_email", description: "SendGrid sender email address", isSecret: false },
  { key: "slack_bot_token", description: "Slack Bot OAuth token", isSecret: true },
  { key: "analysis_prompt", description: "AI code analysis prompt", value: DEFAULT_ANALYSIS_PROMPT, isSecret: false },
  { key: "article_style_prompt", description: "AI article writing style prompt", value: DEFAULT_ARTICLE_STYLE_PROMPT, isSecret: false },
  { key: "ask_ai_global_prompt", description: "Global Ask AI system prompt", value: DEFAULT_ASK_AI_GLOBAL_PROMPT, isSecret: false },
  { key: "ask_ai_page_prompt", description: "Page-level Ask AI system prompt", value: DEFAULT_ASK_AI_PAGE_PROMPT, isSecret: false },
  { key: "openrouter_summary_model", description: "OpenRouter model for short summaries (file descriptions, etc.)", value: "", isSecret: false },
  { key: "openrouter_ask_ai_model", description: "OpenRouter model for Ask AI chat (falls back to primary model if empty)", value: "", isSecret: false },
  { key: "openrouter_ask_ai_reasoning_effort", description: "Reasoning effort level for Ask AI chat model", value: "none", isSecret: false },
  { key: "file_summary_prompt", description: "Prompt for generating short file descriptions", value: DEFAULT_FILE_SUMMARY_PROMPT, isSecret: false },
  // Per-prompt model settings
  { key: "analysis_prompt_model", description: "Model for code analysis prompt", value: "anthropic/claude-sonnet-4-20250514", isSecret: false },
  { key: "analysis_prompt_reasoning_effort", description: "Reasoning effort for code analysis", value: "none", isSecret: false },
  { key: "file_summary_prompt_model", description: "Model for file summary prompt", value: "", isSecret: false },
  { key: "file_summary_prompt_reasoning_effort", description: "Reasoning effort for file summaries", value: "none", isSecret: false },
  { key: "ask_ai_global_prompt_model", description: "Model for global Ask AI chat", value: "", isSecret: false },
  { key: "ask_ai_global_prompt_reasoning_effort", description: "Reasoning effort for global Ask AI chat", value: "none", isSecret: false },
  { key: "ask_ai_page_prompt_model", description: "Model for page-level Ask AI chat", value: "", isSecret: false },
  { key: "ask_ai_page_prompt_reasoning_effort", description: "Reasoning effort for page-level Ask AI chat", value: "none", isSecret: false },
];

/** Prompt keys that should be backfilled if currently empty in the DB. */
const promptDefaults: Record<string, string> = {
  analysis_prompt: DEFAULT_ANALYSIS_PROMPT,
  article_style_prompt: DEFAULT_ARTICLE_STYLE_PROMPT,
  ask_ai_global_prompt: DEFAULT_ASK_AI_GLOBAL_PROMPT,
  ask_ai_page_prompt: DEFAULT_ASK_AI_PAGE_PROMPT,
  file_summary_prompt: DEFAULT_FILE_SUMMARY_PROMPT,
};

async function seed() {
  console.log("Seeding site_settings...");
  for (const setting of requiredSettings) {
    await db
      .insert(siteSettings)
      .values({
        key: setting.key,
        value: setting.value ?? "",
        description: setting.description,
        isSecret: setting.isSecret,
      })
      .onConflictDoNothing({ target: siteSettings.key });
  }
  console.log("Seeded site_settings with", requiredSettings.length, "keys.");

  // Backfill: if prompt rows exist but have empty values, populate them
  // with defaults. This handles existing installations that were seeded
  // before prompts had default values.
  let backfilled = 0;
  for (const [key, defaultValue] of Object.entries(promptDefaults)) {
    const result = await db
      .update(siteSettings)
      .set({ value: defaultValue, updatedAt: new Date() })
      .where(and(eq(siteSettings.key, key), eq(siteSettings.value, "")));

    // Drizzle returns the rows affected for neon-http driver
    if (result.rowCount && result.rowCount > 0) {
      backfilled++;
      console.log(`  Backfilled default for: ${key}`);
    }
  }
  if (backfilled > 0) {
    console.log(`Backfilled ${backfilled} empty prompt(s) with defaults.`);
  }

  // Backfill per-prompt model settings from old global model settings.
  // This preserves existing installations' configuration when migrating
  // from the old single-model setup to per-prompt models.
  const modelBackfillMap: Record<string, string> = {
    // analysis (+ article generation fallback) used the primary model
    analysis_prompt_model: "openrouter_model",
    analysis_prompt_reasoning_effort: "openrouter_reasoning_effort",
    // file summary used the dedicated summary model
    file_summary_prompt_model: "openrouter_summary_model",
    // ask AI used dedicated ask AI model (or fell back to primary)
    ask_ai_global_prompt_model: "openrouter_ask_ai_model",
    ask_ai_global_prompt_reasoning_effort: "openrouter_ask_ai_reasoning_effort",
    ask_ai_page_prompt_model: "openrouter_ask_ai_model",
    ask_ai_page_prompt_reasoning_effort: "openrouter_ask_ai_reasoning_effort",
  };

  let modelBackfilled = 0;
  for (const [newKey, oldKey] of Object.entries(modelBackfillMap)) {
    // Read the old setting value
    const [oldRow] = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, oldKey))
      .limit(1);

    if (!oldRow?.value) continue;

    // Only backfill if the new setting is currently empty
    const result = await db
      .update(siteSettings)
      .set({ value: oldRow.value, updatedAt: new Date() })
      .where(and(eq(siteSettings.key, newKey), eq(siteSettings.value, "")));

    if (result.rowCount && result.rowCount > 0) {
      modelBackfilled++;
      console.log(`  Backfilled model setting: ${newKey} <- ${oldKey} (${oldRow.value})`);
    }
  }
  if (modelBackfilled > 0) {
    console.log(`Backfilled ${modelBackfilled} per-prompt model setting(s) from old config.`);
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
