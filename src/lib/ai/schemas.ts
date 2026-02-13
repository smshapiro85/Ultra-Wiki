import { z } from "zod/v4";

/**
 * Schema for a single article plan item returned by the AI analysis.
 */
export const articlePlanSchema = z.object({
  slug: z.string().describe("URL-safe slug for the article (existing or new)"),
  title: z.string().describe("Human-readable article title"),
  action: z.enum(["create", "update"]).describe("Whether to create a new article or update an existing one"),
  content_markdown: z.string().describe("Full article body in Markdown (no code blocks, business-focused)"),
  technical_view_markdown: z.string().describe("Technical view content: related files, DB tables, endpoints"),
  change_summary: z.string().describe("Brief description of what changed and why"),
  related_files: z.array(z.string()).describe("Source file paths related to this article"),
  related_db_tables: z.array(
    z.object({
      table_name: z.string(),
      columns: z.record(z.string(), z.string()).nullable().describe("Key columns and their descriptions, or null"),
      relevance: z.string().describe("Why this table is relevant to the article"),
    })
  ).describe("Database tables related to this article"),
  category_suggestion: z.string().describe("Slug of the suggested category (prefer existing categories)"),
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
