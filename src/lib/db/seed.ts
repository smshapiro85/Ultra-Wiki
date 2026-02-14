import "dotenv/config";
import { db } from "./index";
import { siteSettings } from "./schema";

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
  { key: "analysis_prompt", description: "AI code analysis prompt", isSecret: false },
  { key: "article_style_prompt", description: "AI article writing style prompt", isSecret: false },
  { key: "ask_ai_global_prompt", description: "Global Ask AI system prompt", isSecret: false },
  { key: "ask_ai_page_prompt", description: "Page-level Ask AI system prompt", isSecret: false },
];

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
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
