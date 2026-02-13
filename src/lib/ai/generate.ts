import { generateText } from "ai";
import { getAIModel } from "./client";
import { buildGenerationPrompt } from "./prompts";
import type { AnalysisResponse } from "./schemas";

/**
 * Generate full article content for a single article plan item.
 *
 * If the analysis step already provided substantial content (>100 chars each
 * for both content_markdown and technical_view_markdown), returns it directly
 * without making a second LLM call.
 *
 * Otherwise, calls the AI model with the generation prompt to produce
 * the full article body and technical view.
 */
export async function generateArticle(
  articlePlan: AnalysisResponse["articles"][0],
  stylePrompt: string
): Promise<{
  contentMarkdown: string;
  technicalViewMarkdown: string;
}> {
  // If the analysis already provided substantial content, return directly
  if (
    articlePlan.content_markdown.length > 100 &&
    articlePlan.technical_view_markdown.length > 100
  ) {
    return {
      contentMarkdown: articlePlan.content_markdown,
      technicalViewMarkdown: articlePlan.technical_view_markdown,
    };
  }

  // Otherwise, generate full content via a second LLM call
  const model = await getAIModel();
  const prompt = buildGenerationPrompt(articlePlan, stylePrompt);

  const { text } = await generateText({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a wiki article writer. Generate clear, business-focused documentation following the provided style guidelines. Output the article content followed by the technical view, separated by a '---TECHNICAL_VIEW---' marker.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  // Parse the response -- split on the technical view marker
  const marker = "---TECHNICAL_VIEW---";
  const markerIndex = text.indexOf(marker);

  if (markerIndex === -1) {
    // If no marker found, use the entire text as content and generate
    // a minimal technical view from the plan metadata
    return {
      contentMarkdown: text.trim(),
      technicalViewMarkdown: buildFallbackTechnicalView(articlePlan),
    };
  }

  return {
    contentMarkdown: text.slice(0, markerIndex).trim(),
    technicalViewMarkdown: text.slice(markerIndex + marker.length).trim(),
  };
}

/**
 * Build a fallback technical view from the article plan metadata
 * when the LLM doesn't provide one explicitly.
 */
function buildFallbackTechnicalView(
  articlePlan: AnalysisResponse["articles"][0]
): string {
  const parts: string[] = ["## Technical View", ""];

  if (articlePlan.related_files.length > 0) {
    parts.push("### Related Source Files");
    for (const file of articlePlan.related_files) {
      parts.push(`- \`${file}\``);
    }
    parts.push("");
  }

  if (articlePlan.related_db_tables.length > 0) {
    parts.push("### Related Database Tables");
    for (const table of articlePlan.related_db_tables) {
      parts.push(`- **${table.table_name}**: ${table.relevance}`);
      if (table.columns) {
        for (const [col, desc] of Object.entries(table.columns)) {
          parts.push(`  - \`${col}\`: ${desc}`);
        }
      }
    }
    parts.push("");
  }

  return parts.join("\n");
}
