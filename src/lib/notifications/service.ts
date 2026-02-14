import { eq, and, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, comments, articles } from "@/lib/db/schema";
import { sendSlackDM } from "./slack";
import { sendEmail } from "./email";
import { templates } from "./templates";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Send notifications to a user via their preferred channels.
 * Runs Slack + email in parallel. Never throws.
 */
async function deliverToUser(
  user: {
    notifySlackEnabled: boolean;
    slackUserId: string | null;
    notifyEmailEnabled: boolean;
    email: string | null;
  },
  message: { slack: string; subject: string; html: string }
): Promise<void> {
  const promises: Promise<void>[] = [];

  if (user.notifySlackEnabled && user.slackUserId) {
    promises.push(sendSlackDM(user.slackUserId, message.slack));
  }

  if (user.notifyEmailEnabled && user.email) {
    promises.push(sendEmail(user.email, message.subject, message.html));
  }

  if (promises.length > 0) {
    await Promise.allSettled(promises);
  }
}

// ---------------------------------------------------------------------------
// Notification Functions (fire-and-forget safe)
// ---------------------------------------------------------------------------

/**
 * Notify a user that they were @mentioned in a comment.
 * Checks their notifyOnMention preference before sending.
 */
export async function notifyMention(
  mentionedUserId: string,
  mentionerName: string,
  articleTitle: string,
  articleSlug: string,
  commentPreview: string
): Promise<void> {
  try {
    const db = getDb();
    const [user] = await db
      .select({
        notifyOnMention: users.notifyOnMention,
        notifySlackEnabled: users.notifySlackEnabled,
        slackUserId: users.slackUserId,
        notifyEmailEnabled: users.notifyEmailEnabled,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, mentionedUserId))
      .limit(1);

    if (!user || !user.notifyOnMention) return;

    const message = templates.mention({
      mentionerName,
      articleTitle,
      articleSlug,
      commentPreview,
    });

    await deliverToUser(user, message);
  } catch (error) {
    console.error("[notifications] notifyMention failed:", error);
  }
}

/**
 * Notify users who have commented on or edited an article about a new comment.
 * Excludes the comment author. Checks notifyOnActivity preference.
 */
export async function notifyNewComment(
  articleId: string,
  commentAuthorId: string,
  commenterName: string,
  articleTitle: string,
  articleSlug: string
): Promise<void> {
  try {
    const db = getDb();

    // Find distinct users who previously commented on this article
    const commenters = await db
      .selectDistinct({ userId: comments.userId })
      .from(comments)
      .where(
        and(
          eq(comments.articleId, articleId),
          ne(comments.userId, commentAuthorId)
        )
      );

    // Also get the article's last human editor
    const [article] = await db
      .select({ lastHumanEditorId: articles.lastHumanEditorId })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    // Combine into a unique set of user IDs to notify
    const userIdsToNotify = new Set(commenters.map((c) => c.userId));
    if (article?.lastHumanEditorId && article.lastHumanEditorId !== commentAuthorId) {
      userIdsToNotify.add(article.lastHumanEditorId);
    }

    if (userIdsToNotify.size === 0) return;

    const message = templates.newComment({
      commenterName,
      articleTitle,
      articleSlug,
    });

    // Fetch user preferences for all users and send notifications
    const deliveries: Promise<void>[] = [];

    for (const userId of userIdsToNotify) {
      const [user] = await db
        .select({
          notifyOnActivity: users.notifyOnActivity,
          notifySlackEnabled: users.notifySlackEnabled,
          slackUserId: users.slackUserId,
          notifyEmailEnabled: users.notifyEmailEnabled,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user || !user.notifyOnActivity) continue;

      deliveries.push(deliverToUser(user, message));
    }

    if (deliveries.length > 0) {
      await Promise.allSettled(deliveries);
    }
  } catch (error) {
    console.error("[notifications] notifyNewComment failed:", error);
  }
}

/**
 * Notify the last human editor that an AI sync updated their article.
 */
export async function notifyAiSyncUpdate(
  articleId: string,
  articleTitle: string,
  articleSlug: string
): Promise<void> {
  try {
    const db = getDb();
    const [article] = await db
      .select({ lastHumanEditorId: articles.lastHumanEditorId })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (!article?.lastHumanEditorId) return;

    const [user] = await db
      .select({
        notifyOnActivity: users.notifyOnActivity,
        notifySlackEnabled: users.notifySlackEnabled,
        slackUserId: users.slackUserId,
        notifyEmailEnabled: users.notifyEmailEnabled,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, article.lastHumanEditorId))
      .limit(1);

    if (!user || !user.notifyOnActivity) return;

    const message = templates.aiSyncUpdate({ articleTitle, articleSlug });
    await deliverToUser(user, message);
  } catch (error) {
    console.error("[notifications] notifyAiSyncUpdate failed:", error);
  }
}

/**
 * Notify the last human editor that an AI merge produced a conflict
 * and the article needs review.
 */
export async function notifyAiConflict(
  articleId: string,
  articleTitle: string,
  articleSlug: string
): Promise<void> {
  try {
    const db = getDb();
    const [article] = await db
      .select({ lastHumanEditorId: articles.lastHumanEditorId })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (!article?.lastHumanEditorId) return;

    const [user] = await db
      .select({
        notifyOnActivity: users.notifyOnActivity,
        notifySlackEnabled: users.notifySlackEnabled,
        slackUserId: users.slackUserId,
        notifyEmailEnabled: users.notifyEmailEnabled,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, article.lastHumanEditorId))
      .limit(1);

    if (!user || !user.notifyOnActivity) return;

    const message = templates.aiConflict({ articleTitle, articleSlug });
    await deliverToUser(user, message);
  } catch (error) {
    console.error("[notifications] notifyAiConflict failed:", error);
  }
}
