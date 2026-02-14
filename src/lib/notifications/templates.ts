/**
 * Notification message templates for all event types.
 *
 * Each template returns Slack text, email subject, and HTML body.
 */

/** Escape HTML entities for safe inclusion in email HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Return the base URL for links in notifications. */
function baseUrl(): string {
  const url = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return url.replace(/\/+$/, "");
}

export const templates = {
  mention: ({
    mentionerName,
    articleTitle,
    articleSlug,
    commentPreview,
  }: {
    mentionerName: string;
    articleTitle: string;
    articleSlug: string;
    commentPreview: string;
  }) => ({
    slack: `*${mentionerName}* mentioned you in a comment on "${articleTitle}":\n>${commentPreview}`,
    subject: `${mentionerName} mentioned you on "${articleTitle}"`,
    html: `<p><strong>${esc(mentionerName)}</strong> mentioned you in a comment on <a href="${baseUrl()}/wiki/${articleSlug}">${esc(articleTitle)}</a>:</p><blockquote>${esc(commentPreview)}</blockquote>`,
  }),

  newComment: ({
    commenterName,
    articleTitle,
    articleSlug,
  }: {
    commenterName: string;
    articleTitle: string;
    articleSlug: string;
  }) => ({
    slack: `*${commenterName}* commented on "${articleTitle}"`,
    subject: `New comment on "${articleTitle}"`,
    html: `<p><strong>${esc(commenterName)}</strong> posted a new comment on <a href="${baseUrl()}/wiki/${articleSlug}">${esc(articleTitle)}</a>.</p>`,
  }),

  aiSyncUpdate: ({
    articleTitle,
    articleSlug,
  }: {
    articleTitle: string;
    articleSlug: string;
  }) => ({
    slack: `AI has updated the article "${articleTitle}" based on code changes`,
    subject: `AI updated "${articleTitle}"`,
    html: `<p>The AI pipeline has updated <a href="${baseUrl()}/wiki/${articleSlug}">${esc(articleTitle)}</a> based on recent code changes. Your previous edits have been preserved.</p>`,
  }),

  aiConflict: ({
    articleTitle,
    articleSlug,
  }: {
    articleTitle: string;
    articleSlug: string;
  }) => ({
    slack: `:warning: AI detected a merge conflict on "${articleTitle}" that needs review`,
    subject: `Merge conflict on "${articleTitle}" needs review`,
    html: `<p>The AI pipeline found a merge conflict while updating <a href="${baseUrl()}/wiki/${articleSlug}">${esc(articleTitle)}</a>. Your edits were preserved, but the article needs review.</p>`,
  }),
};
