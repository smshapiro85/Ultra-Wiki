import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod/v4";
import { getDb } from "@/lib/db";
import { aiReviewAnnotations } from "@/lib/db/schema";
import type { UsageTracker } from "./usage";

// ---------------------------------------------------------------------------
// Schema for structured LLM review output
// ---------------------------------------------------------------------------

const reviewAnnotationSchema = z.object({
  annotations: z.array(
    z.object({
      section_heading: z
        .string()
        .describe(
          "The exact section heading text the concern relates to"
        ),
      concern: z
        .string()
        .describe("Specific concern about this section after merge"),
      severity: z
        .enum(["info", "warning", "error"])
        .describe(
          "info=minor note, warning=potential issue, error=likely incorrect"
        ),
    })
  ),
});

// ---------------------------------------------------------------------------
// generateReviewAnnotations
// ---------------------------------------------------------------------------

/**
 * Run an LLM review pass on merged article content to detect semantic issues.
 *
 * Called after a clean three-way merge of human-edited content with AI-generated
 * updates. The LLM looks for contradictions, stale information, and semantic
 * inconsistencies that deterministic merge cannot catch.
 *
 * Annotations are stored in the ai_review_annotations table and never modify
 * article content directly.
 *
 * This function is intentionally wrapped in try/catch at the call site --
 * annotation generation failure should NOT fail the merge.
 */
export async function generateReviewAnnotations(params: {
  articleId: string;
  versionId?: string | null;
  mergedMarkdown: string;
  aiProposedMarkdown: string;
  humanMarkdown: string;
  changeSummary: string;
  model: LanguageModel;
  usageTracker?: UsageTracker;
}): Promise<void> {
  const {
    articleId,
    versionId,
    mergedMarkdown,
    aiProposedMarkdown,
    humanMarkdown,
    changeSummary,
    model,
  } = params;

  const prompt = `You are reviewing a wiki article after an automated three-way merge of AI-generated content with human edits.

## Context
The codebase changed and the AI proposed updated article content. The article had been previously edited by a human. A three-way merge was performed. Your job is to review the MERGED result for semantic issues.

## Change Summary
${changeSummary}

## Human-Edited Version (before merge)
\`\`\`markdown
${humanMarkdown}
\`\`\`

## AI-Proposed Version
\`\`\`markdown
${aiProposedMarkdown}
\`\`\`

## Merged Result (what will be published)
\`\`\`markdown
${mergedMarkdown}
\`\`\`

## Instructions
Analyze the merged content for:
1. **Contradictions** -- places where human edits and AI updates say different things that were both kept
2. **Stale information** -- human additions that may now be outdated given the code changes described in the change summary
3. **Semantic inconsistencies** -- sections where AI and human content don't flow logically together after merge

Rules:
- Only flag genuine concerns, NOT stylistic differences
- Each annotation MUST reference an EXACT section heading from the merged content
- Use severity "error" for likely incorrect information, "warning" for potential issues, "info" for minor notes
- If no concerns exist, return an empty annotations array
- Be concise in your concern descriptions`;

  const { experimental_output, usage, providerMetadata } = await generateText({
    model,
    temperature: 0.2,
    output: Output.object({ schema: reviewAnnotationSchema }),
    messages: [
      {
        role: "system",
        content:
          "You are a technical documentation reviewer. Identify semantic issues in merged wiki content. Be precise and only flag real problems.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  params.usageTracker?.add(usage, providerMetadata);

  if (!experimental_output || experimental_output.annotations.length === 0) {
    return;
  }

  // Insert annotations into the database
  const db = getDb();

  for (const annotation of experimental_output.annotations) {
    await db.insert(aiReviewAnnotations).values({
      articleId,
      versionId: versionId ?? null,
      sectionHeading: annotation.section_heading,
      concern: annotation.concern,
      severity: annotation.severity,
    });
  }

  console.log(
    `[review] Created ${experimental_output.annotations.length} annotation(s) for article ${articleId}`
  );
}
