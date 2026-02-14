import { generateText, Output } from "ai";
import { eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { categories, articles } from "@/lib/db/schema";
import { getOctokit, getRepoConfig } from "@/lib/github/client";
import { withRetry } from "@/lib/github/retry";
import { getAIModel } from "./client";
import { analysisResponseSchema, type AnalysisResponse } from "./schemas";
import { buildAnalysisPrompt, type PromptContext } from "./prompts";

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
  Array<{ id: string; name: string; slug: string; parentName?: string }>
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
function batchFiles(
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
function mergeResponses(responses: AnalysisResponse[]): AnalysisResponse {
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
  articleStylePrompt: string
): Promise<AnalysisResponse> {
  const model = await getAIModel();
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

    const { experimental_output } = await generateText({
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

    if (experimental_output) {
      responses.push(experimental_output);
    }
  }

  if (responses.length === 0) {
    return { articles: [], summary: "No changes analyzed." };
  }

  return mergeResponses(responses);
}
