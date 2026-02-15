import { generateText, Output, type LanguageModel } from "ai";
import { buildGenerationPrompt } from "./prompts";
import { generationResponseSchema, type AnalysisResponse } from "./schemas";

/**
 * Generate full article content for a single article plan item.
 *
 * If the analysis step already provided substantial content (>100 chars),
 * returns it directly without making a second LLM call.
 *
 * Otherwise, calls the AI model with structured output to produce
 * the full article body.
 */
export async function generateArticle(
  articlePlan: AnalysisResponse["articles"][0],
  stylePrompt: string,
  model: LanguageModel
): Promise<{
  contentMarkdown: string;
}> {
  // If the analysis already provided substantial content, return directly
  if (articlePlan.content_markdown.length > 100) {
    return {
      contentMarkdown: articlePlan.content_markdown,
    };
  }

  // Otherwise, generate full content via a second LLM call with structured output
  const prompt = buildGenerationPrompt(articlePlan, stylePrompt);

  const { experimental_output } = await generateText({
    model,
    temperature: 0.2,
    output: Output.object({ schema: generationResponseSchema }),
    messages: [
      {
        role: "system",
        content:
          "You are a wiki article writer. Generate clear, business-focused documentation following the provided style guidelines.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  if (experimental_output) {
    return {
      contentMarkdown: experimental_output.content_markdown,
    };
  }

  // Fallback if structured output returns nothing
  return {
    contentMarkdown: articlePlan.content_markdown || "",
  };
}
