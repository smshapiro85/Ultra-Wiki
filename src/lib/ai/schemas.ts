import { z } from "zod/v4";

/**
 * Schema for a single article plan item returned by the AI analysis.
 */
export const articlePlanSchema = z.object({
  slug: z.string().describe("URL-safe slug for the article (existing or new)"),
  title: z.string().describe("Human-readable article title. When prefixed with a module/category name, use colon format: 'Module: Topic' (e.g., 'Communities: Member Management')"),
  action: z.enum(["create", "update"]).describe("Whether to create a new article or update an existing one"),
  content_markdown: z.string().describe("Full article body in Markdown (no code blocks, business-focused)"),
  change_summary: z.string().describe("Brief description of what changed and why"),
  related_files: z.array(z.string()).describe("Source file paths related to this article"),
  related_db_tables: z.array(
    z.object({
      table_name: z.string(),
      columns: z.nullable(z.array(z.object({
        name: z.string().describe("Column name"),
        description: z.string().describe("Column description"),
      }))).describe("Key columns and their descriptions, or null"),
      relevance: z.string().describe("Why this table is relevant to the article"),
    })
  ).describe("Database tables related to this article"),
  category_suggestion: z.string().describe("Slug of the suggested category (prefer existing categories)"),
  subcategory_suggestion: z.string().nullable().describe(
    "Slug of the suggested subcategory within the category, or null if article should be directly in the category. Only suggest subcategories when the category has 8+ articles covering distinct sub-topics."
  ),
  conflicts_with_human_edits: z.array(z.string()).describe("Descriptions of conflicts with human-edited content, if any"),
});

/**
 * Schema for the full AI analysis response.
 * Contains an array of article plans and an overall summary.
 */
export const analysisResponseSchema = z.object({
  articles: z.array(articlePlanSchema).describe("List of articles to create or update"),
  summary: z.string().describe("Overall summary of the changes analyzed"),
});

/**
 * Inferred TypeScript type for the full analysis response.
 */
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;

/**
 * Inferred TypeScript type for a single article plan.
 */
export type ArticlePlan = z.infer<typeof articlePlanSchema>;

/**
 * Schema for the article generation response (second LLM call).
 * Used when the analysis step only provided a stub and full content is needed.
 */
export const generationResponseSchema = z.object({
  content_markdown: z.string().describe("Full article body in Markdown (no code blocks, business-focused)"),
});

/**
 * Schema for the consolidation review response.
 * Used when the post-analysis step evaluates whether same-category articles
 * should be merged or kept separate.
 */
export const consolidationReviewSchema = z.object({
  decision: z.enum(["merge", "keep_separate"])
    .describe("Whether to merge these articles into one or keep them separate"),
  reasoning: z.string()
    .describe("Brief explanation of why this decision was made"),
  articles: z.array(z.object({
    title: z.string().describe("Article title (plain business language, no jargon)"),
    content_markdown: z.string().describe("Full article content in Markdown"),
    change_summary: z.string().describe("Brief description of what this article covers"),
  })).describe("If merge: array with 1 merged article. If keep_separate: original articles with any title/content fixes applied."),
});
