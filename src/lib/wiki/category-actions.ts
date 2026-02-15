"use server";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { categories, articles } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function ensureUniqueCategorySlug(slug: string): Promise<string> {
  const db = getDb();
  let candidate = slug;
  let suffix = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, candidate))
      .limit(1);

    if (existing.length === 0) return candidate;
    candidate = `${slug}-${suffix}`;
    suffix++;
  }
}

// ---------------------------------------------------------------------------
// createCategory
// ---------------------------------------------------------------------------

export async function createCategory(data: {
  name: string;
  parentCategoryId?: string | null;
}): Promise<{ id: string; slug: string } | { error: string }> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { error: "Unauthorized: admin access required" };
  }

  const name = data.name?.trim();
  if (!name || name.length === 0 || name.length > 100) {
    return { error: "Category name must be between 1 and 100 characters" };
  }

  const db = getDb();

  // If parentCategoryId is provided, verify parent exists and is a root category
  if (data.parentCategoryId) {
    const [parent] = await db
      .select({
        id: categories.id,
        parentCategoryId: categories.parentCategoryId,
      })
      .from(categories)
      .where(eq(categories.id, data.parentCategoryId))
      .limit(1);

    if (!parent) {
      return { error: "Parent category not found" };
    }

    if (parent.parentCategoryId) {
      return { error: "Maximum nesting depth is 2 levels" };
    }
  }

  // Generate slug
  const slug = generateSlug(name);

  // Insert with onConflictDoNothing on slug
  const inserted = await db
    .insert(categories)
    .values({
      name,
      slug,
      parentCategoryId: data.parentCategoryId ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: categories.id, slug: categories.slug });

  if (inserted.length > 0) {
    revalidatePath("/");
    return { id: inserted[0].id, slug: inserted[0].slug };
  }

  // Slug conflict -- look up existing
  const [existing] = await db
    .select({ id: categories.id, slug: categories.slug })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  if (existing) {
    revalidatePath("/");
    return { id: existing.id, slug: existing.slug };
  }

  return { error: "Failed to create category" };
}

// ---------------------------------------------------------------------------
// renameCategory
// ---------------------------------------------------------------------------

export async function renameCategory(data: {
  id: string;
  name: string;
}): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { error: "Unauthorized: admin access required" };
  }

  const name = data.name?.trim();
  if (!name || name.length === 0 || name.length > 100) {
    return { error: "Category name must be between 1 and 100 characters" };
  }

  const db = getDb();

  // Verify category exists
  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, data.id))
    .limit(1);

  if (!category) {
    return { error: "Category not found" };
  }

  // Generate new slug, handle conflicts
  const baseSlug = generateSlug(name);
  const newSlug = await ensureUniqueCategorySlug(baseSlug);

  await db
    .update(categories)
    .set({ name, slug: newSlug })
    .where(eq(categories.id, data.id));

  revalidatePath("/");
  return { success: true };
}

// ---------------------------------------------------------------------------
// deleteCategory
// ---------------------------------------------------------------------------

export async function deleteCategory(data: {
  id: string;
}): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { error: "Unauthorized: admin access required" };
  }

  const db = getDb();

  // Check if category has direct articles
  const directArticles = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.categoryId, data.id))
    .limit(1);

  if (directArticles.length > 0) {
    return {
      error:
        "Cannot delete: category contains articles. Move articles out first.",
    };
  }

  // Check child categories
  const childCategories = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.parentCategoryId, data.id));

  // Check if any child category has articles
  for (const child of childCategories) {
    const childArticles = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.categoryId, child.id))
      .limit(1);

    if (childArticles.length > 0) {
      return {
        error:
          "Cannot delete: category contains articles. Move articles out first.",
      };
    }
  }

  // Delete empty child categories first, then the category itself
  for (const child of childCategories) {
    await db.delete(categories).where(eq(categories.id, child.id));
  }

  await db.delete(categories).where(eq(categories.id, data.id));

  revalidatePath("/");
  return { success: true };
}

// ---------------------------------------------------------------------------
// reorderSidebarItems
// ---------------------------------------------------------------------------

export async function reorderSidebarItems(
  updates: Array<{
    id: string;
    type: "category" | "article";
    parentId: string | null;
    sortOrder: number;
  }>
): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { error: "Unauthorized: admin access required" };
  }

  const db = getDb();

  // Validate depth constraints for category-type updates
  for (const update of updates) {
    if (update.type === "category" && update.parentId) {
      // Verify the target parent has no parentCategoryId itself (depth enforcement)
      const [targetParent] = await db
        .select({ parentCategoryId: categories.parentCategoryId })
        .from(categories)
        .where(eq(categories.id, update.parentId))
        .limit(1);

      if (!targetParent) {
        return { error: `Parent category ${update.parentId} not found` };
      }

      if (targetParent.parentCategoryId) {
        return {
          error: "Maximum nesting depth is 2 levels",
        };
      }
    }
  }

  // Batch update
  for (const update of updates) {
    if (update.type === "category") {
      await db
        .update(categories)
        .set({
          sortOrder: update.sortOrder,
          parentCategoryId: update.parentId,
        })
        .where(eq(categories.id, update.id));
    } else {
      await db
        .update(articles)
        .set({
          sortOrder: update.sortOrder,
          categoryId: update.parentId,
        })
        .where(eq(articles.id, update.id));
    }
  }

  revalidatePath("/");
  return { success: true };
}
