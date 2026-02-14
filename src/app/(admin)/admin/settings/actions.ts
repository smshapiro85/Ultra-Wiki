"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { CronExpressionParser } from "cron-parser";
import { auth } from "@/lib/auth";
import { getSettingsForUI, setSetting } from "@/lib/settings";
import { SETTING_KEYS, MASK_VALUE } from "@/lib/settings/constants";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized: Admin access required");
  }
  return session;
}

/**
 * Load all settings for the UI. Secret values are masked.
 */
export async function loadSettings() {
  await requireAdmin();
  return getSettingsForUI(Object.values(SETTING_KEYS));
}

// -- General Settings ---------------------------------------------------------

const generalSchema = z.object({
  github_repo_url: z.union([z.string().url("Invalid URL"), z.literal("")]),
  github_branch: z.string().trim().max(200),
  sync_cron_schedule: z.string().trim(),
});

export async function saveGeneralSettings(
  _prevState: { success: boolean; error?: string } | null,
  formData: FormData
) {
  await requireAdmin();

  const raw = {
    github_repo_url: (formData.get("github_repo_url") as string) ?? "",
    github_branch: (formData.get("github_branch") as string) ?? "main",
    sync_cron_schedule: (formData.get("sync_cron_schedule") as string) ?? "",
  };

  const result = generalSchema.safeParse(raw);
  if (!result.success) {
    const firstError = result.error.issues[0]?.message ?? "Validation failed";
    return { success: false, error: firstError };
  }

  const { github_repo_url, github_branch, sync_cron_schedule } = result.data;

  // Validate cron expression if provided
  if (sync_cron_schedule) {
    try {
      CronExpressionParser.parse(sync_cron_schedule);
    } catch {
      return { success: false, error: "Invalid cron expression" };
    }
  }

  try {
    await setSetting(SETTING_KEYS.github_repo_url, github_repo_url);
    await setSetting(SETTING_KEYS.github_branch, github_branch);
    await setSetting(SETTING_KEYS.sync_cron_schedule, sync_cron_schedule);

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to save general settings:", error);
    return { success: false, error: "Failed to save settings" };
  }
}

// -- API Keys -----------------------------------------------------------------

export async function saveApiKeys(
  _prevState: { success: boolean; error?: string } | null,
  formData: FormData
) {
  await requireAdmin();

  const fields = [
    { key: SETTING_KEYS.github_api_key, field: "github_api_key" },
    { key: SETTING_KEYS.openrouter_api_key, field: "openrouter_api_key" },
    { key: SETTING_KEYS.openrouter_model, field: "openrouter_model" },
    { key: SETTING_KEYS.openrouter_reasoning_effort, field: "openrouter_reasoning_effort" },
    { key: SETTING_KEYS.sendgrid_api_key, field: "sendgrid_api_key" },
    { key: SETTING_KEYS.sendgrid_from_email, field: "sendgrid_from_email" },
    { key: SETTING_KEYS.slack_bot_token, field: "slack_bot_token" },
  ];

  try {
    for (const { key, field } of fields) {
      const value = (formData.get(field) as string) ?? "";
      // CRITICAL: skip saving if value is the mask — admin didn't change it
      if (value === MASK_VALUE) continue;
      await setSetting(key, value);
    }

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to save API keys:", error);
    return { success: false, error: "Failed to save API keys" };
  }
}

// -- AI Prompts ---------------------------------------------------------------

export async function saveAiPrompts(
  _prevState: { success: boolean; error?: string } | null,
  formData: FormData
) {
  await requireAdmin();

  const fields = [
    { key: SETTING_KEYS.analysis_prompt, field: "analysis_prompt" },
    { key: SETTING_KEYS.article_style_prompt, field: "article_style_prompt" },
    { key: SETTING_KEYS.ask_ai_global_prompt, field: "ask_ai_global_prompt" },
    { key: SETTING_KEYS.ask_ai_page_prompt, field: "ask_ai_page_prompt" },
  ];

  try {
    for (const { key, field } of fields) {
      const value = (formData.get(field) as string) ?? "";
      await setSetting(key, value);
    }

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to save AI prompts:", error);
    return { success: false, error: "Failed to save AI prompts" };
  }
}
