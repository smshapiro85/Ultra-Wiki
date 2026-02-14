import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// =============================================================================
// Custom Types
// =============================================================================

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// =============================================================================
// Enums
// =============================================================================

export const roleEnum = pgEnum("role", ["admin", "user"]);

export const changeSourceEnum = pgEnum("change_source", [
  "ai_generated",
  "ai_updated",
  "human_edited",
  "ai_merged",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "running",
  "completed",
  "failed",
]);

export const triggerTypeEnum = pgEnum("trigger_type", [
  "scheduled",
  "manual",
]);

export const aiConversationModeEnum = pgEnum("ai_conversation_mode", [
  "global",
  "page",
]);

export const aiMessageRoleEnum = pgEnum("ai_message_role", [
  "user",
  "assistant",
]);

// =============================================================================
// Auth.js Required Tables
// =============================================================================

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  // Application-specific columns
  role: roleEnum("role").default("user").notNull(),
  avatarUrl: text("avatar_url"),
  notifySlackEnabled: boolean("notify_slack_enabled")
    .default(false)
    .notNull(),
  slackUserId: text("slack_user_id"),
  notifyEmailEnabled: boolean("notify_email_enabled")
    .default(false)
    .notNull(),
  notifyOnMention: boolean("notify_on_mention").default(true).notNull(),
  notifyOnActivity: boolean("notify_on_activity").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
);

// =============================================================================
// Application Tables
// =============================================================================

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  icon: text("icon"),
  sortOrder: integer("sort_order"),
  parentCategoryId: uuid("parent_category_id").references(
    (): any => categories.id
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").unique().notNull(),
    contentMarkdown: text("content_markdown").notNull(),
    contentJson: jsonb("content_json"),
    technicalViewMarkdown: text("technical_view_markdown"),
    categoryId: uuid("category_id").references(() => categories.id),
    parentArticleId: uuid("parent_article_id").references(
      (): any => articles.id
    ),
    sortOrder: integer("sort_order"),
    lastAiGeneratedAt: timestamp("last_ai_generated_at", {
      withTimezone: true,
    }),
    lastHumanEditedAt: timestamp("last_human_edited_at", {
      withTimezone: true,
    }),
    lastHumanEditorId: uuid("last_human_editor_id").references(
      () => users.id
    ),
    hasHumanEdits: boolean("has_human_edits").default(false).notNull(),
    needsReview: boolean("needs_review").default(false).notNull(),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      () =>
        sql`to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content_markdown, ''))`
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_articles_search").using("gin", t.searchVector),
    index("idx_articles_category").on(t.categoryId),
    index("idx_articles_parent").on(t.parentArticleId),
  ]
);

export const userBookmarks = pgTable(
  "user_bookmarks",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.articleId] })]
);

export const articleVersions = pgTable(
  "article_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    contentMarkdown: text("content_markdown").notNull(),
    contentJson: jsonb("content_json"),
    technicalViewMarkdown: text("technical_view_markdown"),
    changeSource: changeSourceEnum("change_source").notNull(),
    changeSummary: text("change_summary"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_article_versions_article").on(t.articleId)]
);

export const githubFiles = pgTable("github_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  filePath: text("file_path").unique().notNull(),
  fileSha: text("file_sha"),
  contentHash: text("content_hash"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const excludedPaths = pgTable("excluded_paths", {
  id: uuid("id").defaultRandom().primaryKey(),
  pattern: text("pattern").unique().notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const articleFileLinks = pgTable(
  "article_file_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    githubFileId: uuid("github_file_id")
      .notNull()
      .references(() => githubFiles.id, { onDelete: "cascade" }),
    relevanceExplanation: text("relevance_explanation"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("idx_article_file_links_unique").on(
      t.articleId,
      t.githubFileId
    ),
  ]
);

export const articleDbTables = pgTable(
  "article_db_tables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    tableName: text("table_name").notNull(),
    columns: jsonb("columns"),
    relevanceExplanation: text("relevance_explanation"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("idx_article_db_tables_unique").on(t.articleId, t.tableName),
  ]
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentCommentId: uuid("parent_comment_id").references(
      (): any => comments.id
    ),
    contentMarkdown: text("content_markdown").notNull(),
    isResolved: boolean("is_resolved").default(false).notNull(),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_comments_article").on(t.articleId)]
);

export const mentions = pgTable(
  "mentions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    mentionedUserId: uuid("mentioned_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("idx_mentions_unique").on(t.commentId, t.mentionedUserId),
  ]
);

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    articleId: uuid("article_id").references(() => articles.id, {
      onDelete: "cascade",
    }),
    mode: aiConversationModeEnum("mode").notNull(),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_ai_conversations_user").on(t.userId),
    index("idx_ai_conversations_article").on(t.articleId),
  ]
);

export const aiConversationMessages = pgTable(
  "ai_conversation_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: aiMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_ai_conversation_messages_conversation").on(t.conversationId),
  ]
);

export const articleImages = pgTable(
  "article_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id").references(() => articles.id, {
      onDelete: "set null",
    }),
    fileName: text("file_name").notNull(),
    filePath: text("file_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_article_images_article").on(t.articleId)]
);

export const annotationSeverityEnum = pgEnum("annotation_severity", [
  "info",
  "warning",
  "error",
]);

export const aiReviewAnnotations = pgTable(
  "ai_review_annotations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    versionId: uuid("version_id").references(() => articleVersions.id, {
      onDelete: "set null",
    }),
    sectionHeading: text("section_heading").notNull(),
    concern: text("concern").notNull(),
    severity: annotationSeverityEnum("severity").notNull(),
    isDismissed: boolean("is_dismissed").default(false).notNull(),
    dismissedBy: uuid("dismissed_by").references(() => users.id),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_ai_review_annotations_article").on(t.articleId)]
);

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").default("").notNull(),
  description: text("description"),
  isSecret: boolean("is_secret").default(false).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const syncLogs = pgTable("sync_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  status: syncStatusEnum("status").notNull(),
  triggerType: triggerTypeEnum("trigger_type").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  filesProcessed: integer("files_processed").default(0).notNull(),
  articlesCreated: integer("articles_created").default(0).notNull(),
  articlesUpdated: integer("articles_updated").default(0).notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
