"use server";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name too long"),
  avatarUrl: z
    .union([z.string().url("Invalid URL"), z.literal("")])
    .optional(),
});

export async function updateProfile(
  _prevState: { success: boolean; error?: string } | null,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const raw = {
    name: formData.get("name") as string,
    avatarUrl: formData.get("avatarUrl") as string,
  };

  const result = profileSchema.safeParse(raw);
  if (!result.success) {
    const firstError = result.error.issues[0]?.message ?? "Validation failed";
    return { success: false, error: firstError };
  }

  const { name, avatarUrl } = result.data;

  try {
    const db = getDb();
    await db
      .update(users)
      .set({
        name,
        avatarUrl: avatarUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("Failed to update profile:", error);
    return { success: false, error: "Failed to update profile" };
  }
}

export async function updateNotificationPreferences(
  _prevState: { success: boolean; error?: string } | null,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const notifySlackEnabled = formData.get("notifySlackEnabled") === "on";
  const notifyEmailEnabled = formData.get("notifyEmailEnabled") === "on";
  const notifyOnMention = formData.get("notifyOnMention") === "on";
  const notifyOnActivity = formData.get("notifyOnActivity") === "on";
  const slackUserId =
    (formData.get("slackUserId") as string)?.trim() || null;

  try {
    const db = getDb();
    await db
      .update(users)
      .set({
        notifySlackEnabled,
        notifyEmailEnabled,
        notifyOnMention,
        notifyOnActivity,
        slackUserId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("Failed to update notification preferences:", error);
    return { success: false, error: "Failed to update notification preferences" };
  }
}

export async function updateThemePreference(theme: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  if (!["system", "light", "dark"].includes(theme)) {
    throw new Error("Invalid theme");
  }

  const db = getDb();
  await db
    .update(users)
    .set({ themePreference: theme, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));
}

export async function getUserProfile() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}
