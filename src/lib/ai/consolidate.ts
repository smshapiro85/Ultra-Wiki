import { generateText, Output, type LanguageModel } from "ai";
import { getSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/settings/constants";
import { getConsolidationModel } from "./client";
import { consolidationReviewSchema } from "./schemas";
import type { AnalysisResponse, ArticlePlan } from "./schemas";
import {
  DEFAULT_CONSOLIDATION_PROMPT,
  buildConsolidationPrompt,
} from "./prompts";
import type { UsageTracker } from "./usage";

const CONSOLIDATION_CONCURRENCY = 3;

/**
 * Post-analysis consolidation step.
 *
 * Identifies categories with multiple articles and uses a focused LLM call
 * to decide whether to merge them or keep them separate.
 *
 * - Phase 1: Candidate detection (deterministic, free)
 * - Phase 2: LLM consolidation review (one call per candidate group)
 * - Phase 3: Reassemble the AnalysisResponse
 *
 * Non-fatal: if any LLM call fails, original articles are kept unchanged.
 */
export async function consolidateArticles(
  response: AnalysisResponse,
  analysisModel: LanguageModel,
  stylePrompt: string,
  onLog?: (message: string) => void,
  usageTracker?: UsageTracker
): Promise<AnalysisResponse> {
  const log = onLog ?? ((msg: string) => console.log(`[consolidate] ${msg}`));

  // -------------------------------------------------------------------------
  // Phase 1: Candidate detection
  // -------------------------------------------------------------------------

  // Group articles by category_suggestion
  const categoryGroups = new Map<string, ArticlePlan[]>();
  for (const article of response.articles) {
    const cat = article.category_suggestion.toLowerCase();
    const group = categoryGroups.get(cat) ?? [];
    group.push(article);
    categoryGroups.set(cat, group);
  }

  // Identify candidate groups (2+ articles with substantial content)
  const candidateGroups: Array<{
    category: string;
    articles: ArticlePlan[];
  }> = [];
  const passthroughArticles: ArticlePlan[] = [];

  for (const [category, group] of categoryGroups) {
    // Filter to articles with substantial content (>= 100 chars)
    const substantial = group.filter(
      (a) => a.content_markdown.length >= 100
    );
    const stubs = group.filter((a) => a.content_markdown.length < 100);

    if (substantial.length >= 2) {
      candidateGroups.push({ category, articles: substantial });
      // Stubs pass through unchanged
      passthroughArticles.push(...stubs);
    } else {
      // Single article or only stubs — pass through unchanged
      passthroughArticles.push(...group);
    }
  }

  // Short-circuit: no candidate groups
  if (candidateGroups.length === 0) {
    log("No categories with multiple articles — skipping consolidation");
    return response;
  }

  log(
    `Found ${candidateGroups.length} candidate group(s) for consolidation review`
  );

  // -------------------------------------------------------------------------
  // Phase 2: LLM consolidation review
  // -------------------------------------------------------------------------

  // Read consolidation prompt and get model
  const [consolidationPrompt, consolidationModel] = await Promise.allSettled([
    getSetting(SETTING_KEYS.consolidation_prompt),
    getConsolidationModel(),
  ]);

  const prompt =
    consolidationPrompt.status === "fulfilled" && consolidationPrompt.value
      ? consolidationPrompt.value
      : DEFAULT_CONSOLIDATION_PROMPT;
  const model =
    consolidationModel.status === "fulfilled"
      ? consolidationModel.value
      : analysisModel;

  if (consolidationModel.status === "rejected") {
    log("Consolidation model not configured — falling back to analysis model");
  }

  // Process candidate groups with concurrency limit
  const consolidatedArticles: ArticlePlan[] = [];

  for (
    let i = 0;
    i < candidateGroups.length;
    i += CONSOLIDATION_CONCURRENCY
  ) {
    const chunk = candidateGroups.slice(i, i + CONSOLIDATION_CONCURRENCY);

    const chunkResults = await Promise.allSettled(
      chunk.map(async (group) => {
        return reviewGroup(
          group.category,
          group.articles,
          prompt,
          stylePrompt,
          model,
          usageTracker
        );
      })
    );

    for (let j = 0; j < chunkResults.length; j++) {
      const result = chunkResults[j];
      const group = chunk[j];

      if (result.status === "fulfilled") {
        consolidatedArticles.push(...result.value);
      } else {
        // Non-fatal: keep original articles on failure
        log(
          `Consolidation failed for category "${group.category}": ${
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
          }`
        );
        consolidatedArticles.push(...group.articles);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase 3: Reassemble
  // -------------------------------------------------------------------------

  const finalArticles = [...passthroughArticles, ...consolidatedArticles];

  log(
    `Consolidation complete: ${response.articles.length} -> ${finalArticles.length} articles`
  );

  return {
    ...response,
    articles: finalArticles,
  };
}

/**
 * Review a single candidate group via LLM call.
 * Returns the (possibly merged) articles.
 */
async function reviewGroup(
  category: string,
  articles: ArticlePlan[],
  consolidationPrompt: string,
  stylePrompt: string,
  model: LanguageModel,
  usageTracker?: UsageTracker
): Promise<ArticlePlan[]> {
  const promptText = buildConsolidationPrompt(
    articles.map((a) => ({
      title: a.title,
      content_markdown: a.content_markdown,
      change_summary: a.change_summary,
    })),
    category,
    stylePrompt,
    consolidationPrompt
  );

  const { experimental_output, usage, providerMetadata } = await generateText({
    model,
    temperature: 0.1,
    output: Output.object({ schema: consolidationReviewSchema }),
    messages: [
      {
        role: "system",
        content:
          "You are a wiki article consolidation reviewer. Evaluate whether same-category articles should be merged or kept separate.",
      },
      {
        role: "user",
        content: promptText,
      },
    ],
  });

  usageTracker?.add(usage, providerMetadata);

  const review = experimental_output;
  if (!review) {
    throw new Error("Consolidation review returned no structured output");
  }

  if (review.decision === "merge") {
    return buildMergedArticle(articles, review);
  } else {
    return applyKeepSeparate(articles, review);
  }
}

/**
 * Build a single merged ArticlePlan from the LLM's merge decision.
 */
function buildMergedArticle(
  originals: ArticlePlan[],
  review: {
    articles: Array<{
      title: string;
      content_markdown: string;
      change_summary: string;
    }>;
  }
): ArticlePlan[] {
  const mergedContent = review.articles[0];
  if (!mergedContent) {
    // Fallback: return originals if LLM returned empty array
    return originals;
  }

  // Pick the best slug: prefer "update" actions (they exist in DB), then shortest
  const updateArticles = originals.filter((a) => a.action === "update");
  const slugSource = updateArticles.length > 0 ? updateArticles : originals;
  const bestSlug = slugSource.reduce((shortest, a) =>
    a.slug.length < shortest.slug.length ? a : shortest
  ).slug;

  // Union of related_files (deduplicated)
  const allFiles = [...new Set(originals.flatMap((a) => a.related_files))];

  // Union of related_db_tables (merge by table_name)
  const tableMap = new Map<
    string,
    ArticlePlan["related_db_tables"][number]
  >();
  for (const article of originals) {
    for (const table of article.related_db_tables) {
      const existing = tableMap.get(table.table_name);
      if (!existing || table.relevance.length > existing.relevance.length) {
        // Merge columns from both
        const mergedColumns = existing?.columns
          ? [
              ...existing.columns,
              ...(table.columns ?? []).filter(
                (c) =>
                  !existing.columns!.some((ec) => ec.name === c.name)
              ),
            ]
          : table.columns;

        tableMap.set(table.table_name, {
          ...table,
          columns: mergedColumns,
        });
      }
    }
  }

  // Union of conflicts (deduplicated)
  const allConflicts = [
    ...new Set(originals.flatMap((a) => a.conflicts_with_human_edits)),
  ];

  return [
    {
      slug: bestSlug,
      title: mergedContent.title,
      action: originals.some((a) => a.action === "update")
        ? "update"
        : "create",
      content_markdown: mergedContent.content_markdown,
      change_summary: mergedContent.change_summary,
      related_files: allFiles,
      related_db_tables: [...tableMap.values()],
      category_suggestion: originals[0].category_suggestion,
      subcategory_suggestion: originals[0].subcategory_suggestion ?? null,
      conflicts_with_human_edits: allConflicts,
    },
  ];
}

/**
 * Apply "keep_separate" decision: map LLM output back to original ArticlePlans
 * by index order, replacing title/content/summary with LLM's cleaned versions.
 */
function applyKeepSeparate(
  originals: ArticlePlan[],
  review: {
    articles: Array<{
      title: string;
      content_markdown: string;
      change_summary: string;
    }>;
  }
): ArticlePlan[] {
  return originals.map((original, i) => {
    const cleaned = review.articles[i];
    if (!cleaned) return original;

    return {
      ...original,
      title: cleaned.title,
      content_markdown: cleaned.content_markdown,
      change_summary: cleaned.change_summary,
    };
  });
}
