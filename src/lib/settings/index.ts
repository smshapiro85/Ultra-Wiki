import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { SECRET_KEYS, MASK_VALUE } from "./constants";

/**
 * Get a single setting value by key.
 * Returns null if the key does not exist or has an empty value.
 */
export async function getSetting(key: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, key))
    .limit(1);

  if (!row || row.value === "") return null;
  return row.value;
}

/**
 * Upsert a setting value. Creates the row if it doesn't exist,
 * otherwise updates the existing value.
 */
export async function setSetting(
  key: string,
  value: string,
  isSecret?: boolean
): Promise<void> {
  const db = getDb();
  await db
    .insert(siteSettings)
    .values({
      key,
      value,
      isSecret: isSecret ?? SECRET_KEYS.has(key),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: {
        value,
        updatedAt: new Date(),
      },
    });
}

/**
 * Fetch multiple settings for UI display.
 * Secret values are replaced with MASK_VALUE (or empty string if unset).
 */
export async function getSettingsForUI(
  keys: string[]
): Promise<Record<string, { value: string; isSecret: boolean }>> {
  const db = getDb();
  const rows = await db
    .select({
      key: siteSettings.key,
      value: siteSettings.value,
      isSecret: siteSettings.isSecret,
    })
    .from(siteSettings)
    .where(inArray(siteSettings.key, keys));

  const result: Record<string, { value: string; isSecret: boolean }> = {};

  // Initialize all requested keys with empty defaults
  for (const key of keys) {
    const isSecret = SECRET_KEYS.has(key);
    result[key] = { value: "", isSecret };
  }

  // Fill in actual values, masking secrets
  for (const row of rows) {
    const isSecret = row.isSecret;
    if (isSecret && row.value !== "") {
      result[row.key] = { value: MASK_VALUE, isSecret: true };
    } else {
      result[row.key] = { value: row.value, isSecret };
    }
  }

  return result;
}
