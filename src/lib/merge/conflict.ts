import type { LanguageModel } from "ai";
import { type MergeResult } from "./three-way";
import { createArticleVersion } from "@/lib/content/version";
import { getDb } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface ConflictResolution {
  /** The final Markdown to store as the article's content */
  finalMarkdown: string;
  /** The change source to record for this update */
  changeSource: "ai_updated" | "ai_merged";
  /** Whether the article needs human review */
  needsReview: boolean;
  /** Number of conflicts detected (0 if clean merge) */
  conflictCount: number;
}

/**
 * Resolve conflicts between AI-generated and human-edited content.
 *
 * Strategy:
 * - If conflicts exist: keep the CURRENT (human-edited) version as article
 *   content, store the AI's proposed full content as a version record with
 *   change_source "ai_merged", and set needs_review = true on the article.
 * - If no conflicts: use the merged content as the article content.
 *
 * This follows the principle: "Do NOT store conflict markers in article content."
 * Human edits are always preserved; AI proposals are stored in version history.
 *
 * @param params.articleId       - The article being updated
 * @param params.mergeResult     - Output from mergeArticleContent()
 * @param params.currentMarkdown - Current article content (human-edited version)
 * @param params.aiProposedMarkdown - AI's full proposed content (pre-merge)
 * @param params.changeSummary   - Summary of what the AI changed
 */
export async function resolveConflict(params: {
  articleId: string;
  mergeResult: MergeResult;
  currentMarkdown: string;
  aiProposedMarkdown: string;
  changeSummary: string;
  triggerReview?: boolean;
  model?: LanguageModel;
}): Promise<ConflictResolution> {
  const {
    articleId,
    mergeResult,
    currentMarkdown,
    aiProposedMarkdown,
    changeSummary,
  } = params;

  if (mergeResult.hasConflicts) {
    // CONFLICT PATH: Keep human version, store AI proposal in history,
    // flag for review.
    const db = getDb();

    // Store the AI's proposed content as a version record so it's
    // accessible in the History tab for manual review.
    await createArticleVersion({
      articleId,
      contentMarkdown: aiProposedMarkdown,
      changeSource: "ai_merged",
      changeSummary: `[Conflict] ${changeSummary} (${mergeResult.conflictCount} conflict(s) detected -- human version kept as article content)`,
    });

    // Set needs_review flag on the article
    await db
      .update(articles)
      .set({ needsReview: true })
      .where(eq(articles.id, articleId));

    // Fire-and-forget notification for AI conflict (NOTF-06)
    try {
      const [articleInfo] = await db
        .select({ title: articles.title, slug: articles.slug })
        .from(articles)
        .where(eq(articles.id, articleId))
        .limit(1);
      if (articleInfo) {
        const { notifyAiConflict } = await import(
          "@/lib/notifications/service"
        );
        notifyAiConflict(articleId, articleInfo.title, articleInfo.slug).catch(
          (err) => console.error("[notify] ai conflict failed:", err)
        );
      }
    } catch (err) {
      console.error("[notify] ai conflict notification error:", err);
    }

    return {
      finalMarkdown: currentMarkdown,
      changeSource: "ai_merged",
      needsReview: true,
      conflictCount: mergeResult.conflictCount,
    };
  }

  // CLEAN MERGE PATH: Use the merged content directly.

  // Trigger LLM review for semantic issues after clean merge
  if (params.triggerReview && params.model) {
    try {
      const { generateReviewAnnotations } = await import("@/lib/ai/review");
      await generateReviewAnnotations({
        articleId,
        mergedMarkdown: mergeResult.mergedMarkdown,
        aiProposedMarkdown,
        humanMarkdown: currentMarkdown,
        changeSummary,
        model: params.model,
      });
    } catch (err) {
      console.error("[resolveConflict] Annotation generation failed:", err);
    }
  }

  return {
    finalMarkdown: mergeResult.mergedMarkdown,
    changeSource: "ai_merged",
    needsReview: false,
    conflictCount: 0,
  };
}
