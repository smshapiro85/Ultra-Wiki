/**
 * Setting key constants matching the seed.ts definitions.
 * All keys stored in site_settings table.
 */
export const SETTING_KEYS = {
  github_repo_url: "github_repo_url",
  github_branch: "github_branch",
  github_api_key: "github_api_key",
  openrouter_api_key: "openrouter_api_key",
  openrouter_model: "openrouter_model",
  openrouter_reasoning_effort: "openrouter_reasoning_effort",
  sync_cron_schedule: "sync_cron_schedule",
  sendgrid_api_key: "sendgrid_api_key",
  sendgrid_from_email: "sendgrid_from_email",
  slack_bot_token: "slack_bot_token",
  analysis_prompt: "analysis_prompt",
  article_style_prompt: "article_style_prompt",
  ask_ai_global_prompt: "ask_ai_global_prompt",
  ask_ai_page_prompt: "ask_ai_page_prompt",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

/** Keys whose values must never be sent to the frontend unmasked. */
export const SECRET_KEYS = new Set<string>([
  SETTING_KEYS.github_api_key,
  SETTING_KEYS.openrouter_api_key,
  SETTING_KEYS.sendgrid_api_key,
  SETTING_KEYS.slack_bot_token,
]);

/** Mask shown in UI for secret values that have been set. */
export const MASK_VALUE = "********";
