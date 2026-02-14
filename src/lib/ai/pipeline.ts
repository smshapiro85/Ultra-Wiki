import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  articles,
  categories,
  articleFileLinks,
  articleDbTables,
  githubFiles,
  syncLogs,
} from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/settings/constants";
import {
  fetchFileContents,
  analyzeChanges,
  getFullCategoryTree,
  getArticleIndex,
} from "@/lib/ai/analyze";
import { generateArticle } from "@/lib/ai/generate";
import { mergeArticleContent } from "@/lib/merge/three-way";
import { resolveConflict } from "@/lib/merge/conflict";
import {
  createArticleVersion,
  getLastAIVersion,
} from "@/lib/content/version";
import { normalizeMarkdown } from "@/lib/content/normalize-markdown";
// BlockNote JSON conversion is deferred to viewer/editor — storing markdown
// only in the pipeline avoids @blocknote/server-util createContext crash
// in RSC/Turbopack. contentJson is set to null; converted on first view.
// All markdown is normalized via remark before storage so that diffs between
// AI-generated and human-edited versions only reflect real content changes.

// Re-export ChangeSet from sync for convenience
export type { ChangeSet } from "@/lib/github/sync";

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

/**
 * Generate a URL-safe slug from a title.
 * Lowercases, replaces non-alphanumeric chars with hyphens, trims hyphens.
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/**
 * Ensure a slug is unique in the articles table.
 * If `slug` already exists, append -2, -3, etc.
 */
async function ensureUniqueSlug(slug: string): Promise<string> {
  const db = getDb();
  let candidate = slug;
  let suffix = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.slug, candidate))
      .limit(1);

    if (existing.length === 0) return candidate;
    candidate = `${slug}-${suffix}`;
    suffix++;
  }
}

// ---------------------------------------------------------------------------
// File Summary Generation
// ---------------------------------------------------------------------------

/**
 * Generate short AI summaries for changed source files.
 * Uses the separate summary model (fast/cheap) for 1-2 sentence descriptions.
 * Non-fatal: if summary model is not configured, logs a warning and returns.
 */
async function generateFileSummaries(
  changedFilePaths: string[]
): Promise<void> {
  if (changedFilePaths.length === 0) return;

  // Dynamic import to avoid build-time issues
  let model;
  try {
    const { getSummaryModel } = await import("@/lib/ai/client");
    model = await getSummaryModel();
  } catch (error) {
    console.warn(
      "[pipeline] Summary model not configured, skipping file summaries:",
      error instanceof Error ? error.message : String(error)
    );
    return;
  }

  const { generateText } = await import("ai");
  const { buildFileSummaryPrompt } = await import("@/lib/ai/prompts");

  const customPrompt =
    (await getSetting(SETTING_KEYS.file_summary_prompt)) ?? "";

  // Fetch file contents for the changed paths
  const fileContents = await fetchFileContents(changedFilePaths);

  let count = 0;
  const db = getDb();

  for (const file of fileContents) {
    try {
      const result = await generateText({
        model,
        prompt: buildFileSummaryPrompt(file.path, file.content, customPrompt),
      });

      await db
        .update(githubFiles)
        .set({ aiSummary: result.text.trim().slice(0, 500) })
        .where(eq(githubFiles.filePath, file.path));

      count++;
    } catch (error) {
      console.error(
        `[pipeline] Failed to generate summary for "${file.path}":`,
        error instanceof Error ? error.message : String(error)
      );
      // Continue with remaining files
    }
  }

  console.log(`[pipeline] Generated ${count} file summaries`);
}

// ---------------------------------------------------------------------------
// Pipeline Orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the AI pipeline on a set of changed file paths.
 *
 * Flow:
 *   1. Fetch file contents from GitHub
 *   2. Build context (category tree + article index)
 *   3. Read configured prompts
 *   4. Run AI analysis
 *   5. Process each article (create or update with merge strategy)
 *   6. Update sync_logs with article counts
 *
 * Individual article failures are caught and logged -- they do not
 * abort the entire pipeline.
 */
export async function runAIPipeline(
  syncLogId: string,
  changedFilePaths: string[]
): Promise<{ articlesCreated: number; articlesUpdated: number }> {
  // 1. Early exit
  if (changedFilePaths.length === 0) {
    return { articlesCreated: 0, articlesUpdated: 0 };
  }

  // 2. Fetch file contents from GitHub
  const fileContents = await fetchFileContents(changedFilePaths);
  if (fileContents.length === 0) {
    return { articlesCreated: 0, articlesUpdated: 0 };
  }

  // 3. Build context in parallel
  const [categoryTree, articleIndex] = await Promise.all([
    getFullCategoryTree(),
    getArticleIndex(),
  ]);

  // 4. Read configured prompts (empty string fallback is fine)
  const [analysisPrompt, articleStylePrompt] = await Promise.all([
    getSetting(SETTING_KEYS.analysis_prompt),
    getSetting(SETTING_KEYS.article_style_prompt),
  ]);

  // 5. Run AI analysis
  const analysisResponse = await analyzeChanges(
    fileContents,
    categoryTree,
    articleIndex,
    analysisPrompt ?? "",
    articleStylePrompt ?? ""
  );

  // 6. Process each article
  let articlesCreated = 0;
  let articlesUpdated = 0;
  const errors: string[] = [];

  for (const articlePlan of analysisResponse.articles) {
    try {
      if (articlePlan.action === "create") {
        await processCreateArticle(
          articlePlan,
          categoryTree,
          articleStylePrompt ?? ""
        );
        articlesCreated++;
      } else {
        // action === "update"
        const wasCreated = await processUpdateArticle(
          articlePlan,
          categoryTree,
          articleStylePrompt ?? ""
        );
        if (wasCreated) {
          articlesCreated++;
        } else {
          articlesUpdated++;
        }
      }
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[pipeline] Failed to process article "${articlePlan.slug}":`,
        msg
      );
      errors.push(`${articlePlan.slug}: ${msg}`);
    }
  }

  // 6.5. Generate file summaries for changed files (non-blocking)
  try {
    await generateFileSummaries(changedFilePaths);
  } catch (error) {
    console.error("[pipeline] File summary generation error:", error);
    // Non-fatal -- summaries are supplementary
  }

  // 7. Update sync_logs with article counts
  const db = getDb();
  const updateFields: Record<string, unknown> = {
    articlesCreated,
    articlesUpdated,
  };
  if (errors.length > 0) {
    // Append pipeline errors to any existing error message
    const existingLog = await db
      .select({ errorMessage: syncLogs.errorMessage })
      .from(syncLogs)
      .where(eq(syncLogs.id, syncLogId))
      .limit(1);

    const existingError = existingLog[0]?.errorMessage ?? "";
    const pipelineErrors = `[AI Pipeline] ${errors.join("; ")}`;
    updateFields.errorMessage = existingError
      ? `${existingError} | ${pipelineErrors}`
      : pipelineErrors;
  }

  await db
    .update(syncLogs)
    .set(updateFields)
    .where(eq(syncLogs.id, syncLogId));

  return { articlesCreated, articlesUpdated };
}

// ---------------------------------------------------------------------------
// Article Processing: Create
// ---------------------------------------------------------------------------

async function processCreateArticle(
  articlePlan: {
    slug: string;
    title: string;
    content_markdown: string;
    change_summary: string;
    related_files: string[];
    related_db_tables: Array<{
      table_name: string;
      columns: Array<{ name: string; description: string }> | null;
      relevance: string;
    }>;
    category_suggestion: string;
  },
  categoryTree: Array<{ id: string; name: string; slug: string }>,
  stylePrompt: string
): Promise<void> {
  const db = getDb();

  // a. Resolve or create category
  const categoryId = await resolveOrCreateCategory(
    articlePlan.category_suggestion,
    categoryTree
  );

  // b. Generate full content if needed
  let contentMarkdown = articlePlan.content_markdown;

  if (contentMarkdown.length < 100) {
    const generated = await generateArticle(
      articlePlan as Parameters<typeof generateArticle>[0],
      stylePrompt
    );
    contentMarkdown = generated.contentMarkdown;
  }

  // Normalize markdown so diffs against future human edits are clean
  contentMarkdown = normalizeMarkdown(contentMarkdown);

  // c. contentJson left null — BlockNote conversion deferred to viewer/editor
  //    to avoid @blocknote/server-util createContext crash in RSC/Turbopack.
  const contentJson = null;

  // d. Generate unique slug and insert article
  const slug = await ensureUniqueSlug(
    articlePlan.slug || generateSlug(articlePlan.title)
  );

  const [newArticle] = await db
    .insert(articles)
    .values({
      title: articlePlan.title,
      slug,
      contentMarkdown,
      contentJson,
      categoryId,
      lastAiGeneratedAt: new Date(),
      hasHumanEdits: false,
      needsReview: false,
    })
    .returning({ id: articles.id });

  const articleId = newArticle.id;

  // e. Create initial version
  await createArticleVersion({
    articleId,
    contentMarkdown,
    contentJson,
    changeSource: "ai_generated",
    changeSummary: articlePlan.change_summary,
  });

  // f. Populate article_file_links
  await populateFileLinks(
    articleId,
    articlePlan.related_files,
    articlePlan.change_summary
  );

  // g. Populate article_db_tables
  await populateDbTables(articleId, articlePlan.related_db_tables);
}

// ---------------------------------------------------------------------------
// Article Processing: Update
// ---------------------------------------------------------------------------

/**
 * Process an article update from the AI analysis.
 * Returns true if the article was actually created (fallback for non-existent slug).
 */
async function processUpdateArticle(
  articlePlan: {
    slug: string;
    title: string;
    content_markdown: string;
    change_summary: string;
    related_files: string[];
    related_db_tables: Array<{
      table_name: string;
      columns: Array<{ name: string; description: string }> | null;
      relevance: string;
    }>;
    category_suggestion: string;
  },
  categoryTree: Array<{ id: string; name: string; slug: string }>,
  stylePrompt: string
): Promise<boolean> {
  const db = getDb();

  // a. Look up existing article by slug
  const [existing] = await db
    .select({
      id: articles.id,
      hasHumanEdits: articles.hasHumanEdits,
      contentMarkdown: articles.contentMarkdown,
      contentJson: articles.contentJson,
    })
    .from(articles)
    .where(eq(articles.slug, articlePlan.slug))
    .limit(1);

  // If not found, treat as create
  if (!existing) {
    console.warn(
      `[pipeline] Article "${articlePlan.slug}" not found for update, creating instead.`
    );
    await processCreateArticle(articlePlan, categoryTree, stylePrompt);
    return true;
  }

  const articleId = existing.id;
  let contentMarkdown = articlePlan.content_markdown;

  // Generate full content if the analysis only provided a stub
  if (contentMarkdown.length < 100) {
    const generated = await generateArticle(
      articlePlan as Parameters<typeof generateArticle>[0],
      stylePrompt
    );
    contentMarkdown = generated.contentMarkdown;
  }

  // Normalize markdown so diffs against human edits are clean
  contentMarkdown = normalizeMarkdown(contentMarkdown);

  // b. Check has_human_edits flag
  if (!existing.hasHumanEdits) {
    // AI-only article: overwrite directly (contentJson deferred to viewer/editor)
    await db
      .update(articles)
      .set({
        contentMarkdown,
        contentJson: null,
        lastAiGeneratedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId));

    await createArticleVersion({
      articleId,
      contentMarkdown,
      contentJson: null,
      changeSource: "ai_updated",
      changeSummary: articlePlan.change_summary,
    });
  } else {
    // Human-edited article: run merge strategy
    // i. Get last AI version as merge base
    const lastAIVersion = await getLastAIVersion(articleId);
    const base = lastAIVersion?.contentMarkdown ?? "";

    // ii. Get current article content (human-edited version)
    const currentMarkdown = existing.contentMarkdown;

    // iii. Run three-way merge (operates on markdown — no BlockNote needed)
    const mergeResult = mergeArticleContent(
      base,
      currentMarkdown,
      contentMarkdown
    );

    // iv. Resolve conflicts (triggerReview generates LLM annotations on clean merge)
    const resolution = await resolveConflict({
      articleId,
      mergeResult,
      currentMarkdown,
      aiProposedMarkdown: contentMarkdown,
      changeSummary: articlePlan.change_summary,
      triggerReview: true,
    });

    // v. Update article with resolved content (contentJson deferred)
    await db
      .update(articles)
      .set({
        contentMarkdown: resolution.finalMarkdown,
        contentJson: null,
        lastAiGeneratedAt: new Date(),
        needsReview: resolution.needsReview,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId));

    // vi. Create version (only if clean merge -- conflict path already
    // stored a version inside resolveConflict)
    if (!mergeResult.hasConflicts) {
      await createArticleVersion({
        articleId,
        contentMarkdown: resolution.finalMarkdown,
        contentJson: null,
        changeSource: resolution.changeSource,
        changeSummary: articlePlan.change_summary,
      });
    }
  }

  // c. Update article_file_links: delete and reinsert
  await db
    .delete(articleFileLinks)
    .where(eq(articleFileLinks.articleId, articleId));
  await populateFileLinks(
    articleId,
    articlePlan.related_files,
    articlePlan.change_summary
  );

  // d. Update article_db_tables: delete and reinsert
  await db
    .delete(articleDbTables)
    .where(eq(articleDbTables.articleId, articleId));
  await populateDbTables(articleId, articlePlan.related_db_tables);

  return false;
}

// ---------------------------------------------------------------------------
// Category Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a category by slug or name. If not found, create a new one.
 * Returns the category ID.
 */
async function resolveOrCreateCategory(
  categorySuggestion: string,
  categoryTree: Array<{ id: string; name: string; slug: string }>
): Promise<string | null> {
  if (!categorySuggestion) return null;

  const db = getDb();

  // Try matching by slug first
  const bySlug = categoryTree.find(
    (c) => c.slug === categorySuggestion.toLowerCase()
  );
  if (bySlug) return bySlug.id;

  // Try matching by name (case-insensitive)
  const byName = categoryTree.find(
    (c) => c.name.toLowerCase() === categorySuggestion.toLowerCase()
  );
  if (byName) return byName.id;

  // Not found -- create a new category (or find one that was just created)
  const slug = generateSlug(categorySuggestion);
  const name =
    categorySuggestion.charAt(0).toUpperCase() +
    categorySuggestion.slice(1);

  console.log(`[pipeline] Creating new category: "${name}" (${slug})`);

  // Use onConflictDoNothing in case another article in this batch just created it
  const inserted = await db
    .insert(categories)
    .values({ name, slug })
    .onConflictDoNothing()
    .returning({ id: categories.id });

  let categoryId: string;
  if (inserted.length > 0) {
    categoryId = inserted[0].id;
  } else {
    // Already exists (race condition or duplicate in batch) — look it up
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);
    categoryId = existing.id;
  }

  // Update the in-memory cache so subsequent articles in this pipeline run find it
  categoryTree.push({ id: categoryId, name, slug });

  return categoryId;
}

// ---------------------------------------------------------------------------
// File Links and DB Tables
// ---------------------------------------------------------------------------

/**
 * Populate article_file_links for an article from the AI analysis output.
 */
async function populateFileLinks(
  articleId: string,
  relatedFiles: string[],
  changeSummary: string
): Promise<void> {
  if (relatedFiles.length === 0) return;

  const db = getDb();

  for (const filePath of relatedFiles) {
    // Look up the github_files record by filePath
    const [fileRecord] = await db
      .select({ id: githubFiles.id })
      .from(githubFiles)
      .where(eq(githubFiles.filePath, filePath))
      .limit(1);

    if (fileRecord) {
      try {
        await db.insert(articleFileLinks).values({
          articleId,
          githubFileId: fileRecord.id,
          relevanceExplanation: changeSummary || "Related source file",
        });
      } catch (error) {
        // Ignore duplicate key errors (unique constraint on articleId + githubFileId)
        const msg = String(error);
        if (!msg.includes("unique") && !msg.includes("duplicate")) {
          throw error;
        }
      }
    }
  }
}

/**
 * Populate article_db_tables for an article from the AI analysis output.
 */
async function populateDbTables(
  articleId: string,
  relatedDbTables: Array<{
    table_name: string;
    columns: Array<{ name: string; description: string }> | null;
    relevance: string;
  }>
): Promise<void> {
  if (relatedDbTables.length === 0) return;

  const db = getDb();

  for (const table of relatedDbTables) {
    try {
      await db.insert(articleDbTables).values({
        articleId,
        tableName: table.table_name,
        columns: table.columns ?? null,
        relevanceExplanation: table.relevance || "Related database table",
      });
    } catch (error) {
      // Ignore duplicate key errors (unique constraint on articleId + tableName)
      const msg = String(error);
      if (!msg.includes("unique") && !msg.includes("duplicate")) {
        throw error;
      }
    }
  }
}
