/**
 * One-time script to update the analysis and article style prompts
 * in the site_settings table with the hardened versions from prompts.ts.
 *
 * Usage: npx tsx src/lib/db/update-prompts.ts
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { siteSettings } from "./schema";
import {
  DEFAULT_ANALYSIS_PROMPT,
  DEFAULT_ARTICLE_STYLE_PROMPT,
  DEFAULT_CONSOLIDATION_PROMPT,
} from "../ai/prompts";

async function updatePrompts() {
  console.log("Updating prompts in site_settings...\n");

  // Update analysis prompt
  const analysisResult = await db
    .update(siteSettings)
    .set({ value: DEFAULT_ANALYSIS_PROMPT, updatedAt: new Date() })
    .where(eq(siteSettings.key, "analysis_prompt"));

  console.log(
    `analysis_prompt: ${analysisResult.rowCount ?? 0} row(s) updated`
  );

  // Update article style prompt
  const styleResult = await db
    .update(siteSettings)
    .set({ value: DEFAULT_ARTICLE_STYLE_PROMPT, updatedAt: new Date() })
    .where(eq(siteSettings.key, "article_style_prompt"));

  console.log(
    `article_style_prompt: ${styleResult.rowCount ?? 0} row(s) updated`
  );

  // Upsert consolidation prompt (new setting — may not exist yet)
  const consolidationResult = await db
    .insert(siteSettings)
    .values({ key: "consolidation_prompt", value: DEFAULT_CONSOLIDATION_PROMPT })
    .onConflictDoNothing();

  console.log(
    `consolidation_prompt: ${consolidationResult.rowCount ?? 0} row(s) inserted (onConflictDoNothing)`
  );

  console.log("\nDone. The hardened prompts are now active in the database.");
}

updatePrompts().catch((err) => {
  console.error("Update failed:", err);
  process.exit(1);
});
