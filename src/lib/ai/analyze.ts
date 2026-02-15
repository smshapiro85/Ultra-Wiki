import { generateText, Output, type LanguageModel } from "ai";
import { eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  categories,
  articles,
  articleFileLinks,
  githubFiles,
} from "@/lib/db/schema";
import { getOctokit, getRepoConfig } from "@/lib/github/client";
import { withRetry } from "@/lib/github/retry";
import { analysisResponseSchema, type AnalysisResponse } from "./schemas";
import { buildAnalysisPrompt, type PromptContext } from "./prompts";
import type { PlanResponse } from "./plan";
import type { UsageTracker } from "./usage";

// ---------------------------------------------------------------------------
// File Content Fetching
// ---------------------------------------------------------------------------

/**
 * Fetch actual file contents from GitHub for the given file paths.
 *
 * Uses Octokit repos.getContent with base64 decoding.
 * - Skips 404s (deleted files) silently
 * - Skips directories/non-file responses
 * - Skips files larger than 1MB (GitHub API limit)
 * - Batches fetches with concurrency limit of 5 to avoid rate limiting
 * - Retries transient errors using shared retry utility
 */
export async function fetchFileContents(
  filePaths: string[]
): Promise<Array<{ path: string; content: string }>> {
  const octokit = await getOctokit();
  const config = await getRepoConfig();

  const results: Array<{ path: string; content: string }> = [];
  const CONCURRENCY = 5;

  // Process in chunks of CONCURRENCY
  for (let i = 0; i < filePaths.length; i += CONCURRENCY) {
    const chunk = filePaths.slice(i, i + CONCURRENCY);

    const chunkResults = await Promise.allSettled(
      chunk.map((filePath) =>
        withRetry(async () => {
          try {
            const { data } = await octokit.repos.getContent({
              owner: config.owner,
              repo: config.repo,
              path: filePath,
              ref: config.branch,
            });

            // getContent returns different shapes for files vs directories
            if (Array.isArray(data) || data.type !== "file") {
              return null;
            }

            // Skip files larger than 1MB
            if (data.size > 1_000_000) {
              console.warn(
                `Skipping large file (${data.size} bytes): ${filePath}`
              );
              return null;
            }

            // Decode base64 content
            if (data.encoding === "base64" && data.content) {
              return {
                path: filePath,
                content: Buffer.from(data.content, "base64").toString("utf-8"),
              };
            }

            return null;
          } catch (error: unknown) {
            // 404 = file deleted or not found, skip silently
            if (
              typeof error === "object" &&
              error !== null &&
              "status" in error &&
              (error as { status: number }).status === 404
            ) {
              return null;
            }
            throw error;
          }
        })
      )
    );

    for (const result of chunkResults) {
      if (result.status === "fulfilled" && result.value !== null) {
        results.push(result.value);
      }
      // Rejected promises (non-transient errors) are logged but skipped
      if (result.status === "rejected") {
        console.warn("Failed to fetch file content:", result.reason);
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Database Context Queries
// ---------------------------------------------------------------------------

/**
 * Query the full category tree with parent names for prompt context.
 * Returns categories sorted by sortOrder.
 */
export async function getFullCategoryTree(): Promise<
  Array<{ id: string; name: string; slug: string; parentName?: string; parentCategoryId?: string | null }>
> {
  const db = getDb();

  // Self-join to get parent category name
  const parentCategories = db.$with("parent_categories").as(
    db
      .select({
        id: categories.id,
        name: categories.name,
      })
      .from(categories)
  );

  // Query all categories with parent name via left join
  const allCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      sortOrder: categories.sortOrder,
      parentCategoryId: categories.parentCategoryId,
    })
    .from(categories)
    .orderBy(categories.sortOrder);

  // Build parent name lookup
  const categoryMap = new Map(
    allCategories.map((c) => [c.id, c.name])
  );

  return allCategories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentCategoryId: c.parentCategoryId ?? null,
    ...(c.parentCategoryId
      ? { parentName: categoryMap.get(c.parentCategoryId) }
      : {}),
  }));
}

/**
 * Query the article index with category names for prompt context.
 * Returns all articles with their category name and human-edit status.
 */
export async function getArticleIndex(): Promise<
  Array<{
    slug: string;
    title: string;
    categoryName: string;
    hasHumanEdits: boolean;
  }>
> {
  const db = getDb();

  const rows = await db
    .select({
      slug: articles.slug,
      title: articles.title,
      hasHumanEdits: articles.hasHumanEdits,
      categoryId: articles.categoryId,
    })
    .from(articles);

  // Build category name lookup
  const allCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
    })
    .from(categories);

  const categoryMap = new Map(
    allCategories.map((c) => [c.id, c.name])
  );

  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    categoryName: r.categoryId
      ? categoryMap.get(r.categoryId) ?? "Uncategorized"
      : "Uncategorized",
    hasHumanEdits: r.hasHumanEdits,
  }));
}

// ---------------------------------------------------------------------------
// Existing Article-File Link Resolution
// ---------------------------------------------------------------------------

/**
 * Bulk-resolve existing article links for a set of file paths.
 *
 * Queries githubFiles → articleFileLinks → articles (LEFT JOIN categories)
 * to find which articles already reference each file. Returns a Map keyed
 * by file path with arrays of {slug, title, categoryName}.
 *
 * Chunks the query in batches of 500 paths to avoid parameter-count limits.
 */
export async function resolveExistingArticleLinks(
  filePaths: string[]
): Promise<Map<string, Array<{ slug: string; title: string; categoryName: string }>>> {
  if (filePaths.length === 0) return new Map();

  const db = getDb();
  const BATCH_SIZE = 500;
  const result = new Map<string, Array<{ slug: string; title: string; categoryName: string }>>();

  // Build category lookup once
  const allCategories = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories);
  const categoryMap = new Map(allCategories.map((c) => [c.id, c.name]));

  for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
    const batch = filePaths.slice(i, i + BATCH_SIZE);

    const rows = await db
      .select({
        filePath: githubFiles.filePath,
        slug: articles.slug,
        title: articles.title,
        categoryId: articles.categoryId,
      })
      .from(githubFiles)
      .innerJoin(articleFileLinks, eq(articleFileLinks.githubFileId, githubFiles.id))
      .innerJoin(articles, eq(articles.id, articleFileLinks.articleId))
      .where(inArray(githubFiles.filePath, batch));

    for (const row of rows) {
      const entry = {
        slug: row.slug,
        title: row.title,
        categoryName: row.categoryId
          ? categoryMap.get(row.categoryId) ?? "Uncategorized"
          : "Uncategorized",
      };

      const existing = result.get(row.filePath);
      if (existing) {
        existing.push(entry);
      } else {
        result.set(row.filePath, [entry]);
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// AI Analysis
// ---------------------------------------------------------------------------

/**
 * Maximum characters of file content per LLM batch call.
 * Conservative limit to stay within context windows.
 */
const MAX_CHARS_PER_BATCH = 50_000;

/**
 * Maximum files per LLM batch call.
 */
const MAX_FILES_PER_BATCH = 25;

/**
 * Split file contents into batches respecting size and count limits.
 */
export function batchFiles(
  fileContents: Array<{ path: string; content: string }>
): Array<Array<{ path: string; content: string }>> {
  const batches: Array<Array<{ path: string; content: string }>> = [];
  let currentBatch: Array<{ path: string; content: string }> = [];
  let currentChars = 0;

  for (const file of fileContents) {
    const fileChars = file.content.length;

    // Start a new batch if adding this file would exceed limits
    if (
      currentBatch.length > 0 &&
      (currentBatch.length >= MAX_FILES_PER_BATCH ||
        currentChars + fileChars > MAX_CHARS_PER_BATCH)
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }

    currentBatch.push(file);
    currentChars += fileChars;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Merge multiple batch responses into a single AnalysisResponse.
 * Deduplicates articles by slug, preferring later batches for updates.
 */
export function mergeResponses(responses: AnalysisResponse[]): AnalysisResponse {
  if (responses.length === 1) return responses[0];

  const articleMap = new Map<string, AnalysisResponse["articles"][0]>();
  const summaries: string[] = [];

  for (const response of responses) {
    summaries.push(response.summary);
    for (const article of response.articles) {
      // Later batches overwrite earlier ones (prefer updates)
      articleMap.set(article.slug, article);
    }
  }

  return {
    articles: Array.from(articleMap.values()),
    summary: summaries.join(" "),
  };
}

/**
 * Analyze code changes using the AI model.
 *
 * Sends file contents along with existing category tree and article index
 * to the LLM for structured analysis. Returns a plan of articles to
 * create or update.
 *
 * Automatically batches files if there are too many for a single LLM call.
 */
export async function analyzeChanges(
  fileContents: Array<{ path: string; content: string }>,
  categoryTree: Array<{
    id: string;
    name: string;
    slug: string;
    parentName?: string;
  }>,
  articleIndex: Array<{
    slug: string;
    title: string;
    categoryName: string;
    hasHumanEdits: boolean;
  }>,
  analysisPrompt: string,
  articleStylePrompt: string,
  model: LanguageModel,
  usageTracker?: UsageTracker
): Promise<AnalysisResponse> {
  const batches = batchFiles(fileContents);

  const responses: AnalysisResponse[] = [];

  for (const batch of batches) {
    const ctx: PromptContext = {
      changedFiles: batch,
      existingCategories: categoryTree,
      existingArticles: articleIndex,
      analysisPrompt,
      articleStylePrompt,
    };

    const prompt = buildAnalysisPrompt(ctx);

    const { experimental_output, usage, providerMetadata } = await generateText({
      model,
      temperature: 0.2,
      output: Output.object({ schema: analysisResponseSchema }),
      messages: [
        {
          role: "system",
          content:
            "You are a code analysis assistant that generates structured wiki article plans from source code changes. Always respond with valid JSON matching the required schema.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    usageTracker?.add(usage, providerMetadata);

    if (experimental_output) {
      responses.push(experimental_output);
    }
  }

  if (responses.length === 0) {
    return { articles: [], summary: "No changes analyzed." };
  }

  return mergeResponses(responses);
}

// ---------------------------------------------------------------------------
// Plan-Aware Group Analysis (Stage 3)
// ---------------------------------------------------------------------------

/**
 * Format plan context with compact other-group summaries.
 *
 * Current group: full detail (files list, proposed articles with scope).
 * Other groups: one-line summary each with description, article titles, and file count.
 */
export function buildPlanContext(
  plan: PlanResponse,
  currentGroupId: string
): string {
  const lines: string[] = [
    "## Full Analysis Plan",
    "",
    `Strategy: ${plan.rationale}`,
    "",
  ];

  for (const group of plan.groups) {
    if (group.id === currentGroupId) {
      // Current group: full detail
      lines.push(`### Group: ${group.id} <<< YOU ARE HERE`);
      lines.push(`Description: ${group.description}`);
      lines.push(`Files: ${group.files.join(", ")}`);
      lines.push("Proposed articles:");
      for (const article of group.proposed_articles) {
        lines.push(
          `  - ${article.title} (${article.slug}) [${article.action}]: ${article.scope}`
        );
      }
      lines.push("");
    } else {
      // Other groups: compact one-line summary
      const articleTitles = group.proposed_articles
        .map((a) => `"${a.title}"`)
        .join(", ");
      lines.push(
        `- **${group.id}**: ${group.description} — Articles: ${articleTitles} (${group.files.length} files)`
      );
    }
  }

  return lines.join("\n");
}

/**
 * Inject plan context into the standard analysis prompt.
 * Inserts plan context + group article outlines between the
 * "## Article Writing Style" section and "## Changed Files".
 *
 * Optional params add shared context and existing article link sections.
 */
export function injectPlanContext(
  basePrompt: string,
  planContext: string,
  group: PlanResponse["groups"][0],
  sharedContextSummaries?: Array<{ path: string; summary: string }>,
  groupArticleLinks?: Map<string, Array<{ slug: string; title: string }>>
): string {
  const articleOutlines = group.proposed_articles
    .map(
      (a) =>
        `- **${a.title}** (${a.slug}) [${a.action}]: ${a.scope}`
    )
    .join("\n");

  const sections: string[] = [
    `## Analysis Plan Context`,
    "",
    "You are analyzing ONE group in a multi-group pipeline. Other groups are handling other files. Follow the plan below -- only produce articles for YOUR group.",
    "",
    planContext,
    "",
    "## Your Group's Article Assignments",
    "",
    "Produce ONLY these articles for this group:",
    articleOutlines,
    "",
    "Do NOT create articles for files or topics assigned to other groups.",
  ];

  // Shared context section
  if (sharedContextSummaries && sharedContextSummaries.length > 0) {
    sections.push("");
    sections.push("## Shared Context (read-only)");
    sections.push("");
    sections.push(
      "These shared infrastructure/utility files are provided for reference only. Do NOT write articles about them — they are handled separately."
    );
    sections.push("");
    for (const f of sharedContextSummaries) {
      sections.push(`- ${f.path}: ${f.summary}`);
    }
  }

  // Existing article links section
  if (groupArticleLinks && groupArticleLinks.size > 0) {
    sections.push("");
    sections.push("## Existing Article Links");
    sections.push("");
    sections.push(
      "These files are already linked to existing articles. Prefer updating the linked articles rather than creating new ones for the same content."
    );
    sections.push("");
    for (const [filePath, links] of groupArticleLinks) {
      const articleList = links
        .map((a) => `"${a.title}" (${a.slug})`)
        .join(", ");
      sections.push(`- ${filePath} → ${articleList}`);
    }
  }

  const injection = "\n" + sections.join("\n") + "\n\n";

  // Insert before "## Changed Files"
  const changedFilesMarker = "## Changed Files";
  const idx = basePrompt.indexOf(changedFilesMarker);
  if (idx === -1) {
    // Fallback: append plan context before the prompt
    return injection + basePrompt;
  }

  return basePrompt.slice(0, idx) + injection + basePrompt.slice(idx);
}

/**
 * Analyze a single planned group of files.
 *
 * Like `analyzeChanges` but for a single group from the planning stage.
 * Injects plan context so the LLM knows about other groups and only
 * produces articles assigned to this group.
 * Sub-batches internally via `batchFiles()` if the group is too large.
 *
 * Optional params inject shared context summaries and existing article links.
 */
export async function analyzeGroup(
  groupFiles: Array<{ path: string; content: string }>,
  fullPlan: PlanResponse,
  groupId: string,
  categoryTree: Array<{
    id: string;
    name: string;
    slug: string;
    parentName?: string;
  }>,
  articleIndex: Array<{
    slug: string;
    title: string;
    categoryName: string;
    hasHumanEdits: boolean;
  }>,
  analysisPrompt: string,
  articleStylePrompt: string,
  model: LanguageModel,
  sharedContextSummaries?: Array<{ path: string; summary: string }>,
  groupArticleLinks?: Map<string, Array<{ slug: string; title: string }>>,
  usageTracker?: UsageTracker
): Promise<AnalysisResponse> {
  const group = fullPlan.groups.find((g) => g.id === groupId);
  if (!group) {
    console.warn(`[analyze] Group "${groupId}" not found in plan, skipping`);
    return { articles: [], summary: `Group ${groupId} not found in plan.` };
  }

  const planContext = buildPlanContext(fullPlan, groupId);
  const batches = batchFiles(groupFiles);
  const responses: AnalysisResponse[] = [];

  for (const batch of batches) {
    const ctx: PromptContext = {
      changedFiles: batch,
      existingCategories: categoryTree,
      existingArticles: articleIndex,
      analysisPrompt,
      articleStylePrompt,
    };

    const basePrompt = buildAnalysisPrompt(ctx);
    const prompt = injectPlanContext(
      basePrompt,
      planContext,
      group,
      sharedContextSummaries,
      groupArticleLinks
    );

    const { experimental_output, usage, providerMetadata } = await generateText({
      model,
      temperature: 0.2,
      output: Output.object({ schema: analysisResponseSchema }),
      messages: [
        {
          role: "system",
          content:
            "You are a code analysis assistant that generates structured wiki article plans from source code changes. You are processing one group in a multi-group analysis pipeline. Always respond with valid JSON matching the required schema.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    usageTracker?.add(usage, providerMetadata);

    if (experimental_output) {
      responses.push(experimental_output);
    }
  }

  if (responses.length === 0) {
    return {
      articles: [],
      summary: `No analysis output for group ${groupId}.`,
    };
  }

  return mergeResponses(responses);
}
