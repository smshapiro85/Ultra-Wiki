// =============================================================================
// Data Pattern Analysis (08-01 Task 1)
//
// Category Structure:
// - Categories table supports parent-child hierarchy (parentCategoryId FK)
// - Pipeline resolves categories by slug-first, then case-insensitive name match
// - New categories auto-created when no match found (resolveOrCreateCategory)
// - Category names are auto-capitalized (first char uppercase + rest)
//
// Identified Issues:
// 1. CATEGORY DRIFT: No deterministic rules in prompt for when to create vs. reuse
//    categories. Same folder (e.g., resource-library/) can produce different
//    category assignments across runs because the LLM has no explicit strategy.
// 2. NAMING INCONSISTENCY: resolveOrCreateCategory capitalizes first char only
//    (e.g., "resource-library" -> "Resource-library") but prompt doesn't tell
//    LLM to match existing casing patterns (Title Case, singular/plural).
// 3. FLAT vs. NESTED: No guidance on when to use parent categories vs. top-level.
//    The LLM might create "Modules > Auth" one run and "Authentication" the next.
// 4. GENERIC PARENTS: No rule against creating broad parent categories like
//    "Modules", "Features", or "Components" that add hierarchy without meaning.
//
// Article Content Patterns:
// 1. TITLE DUPLICATION: No rule preventing LLM from starting article content with
//    an H1 that repeats the article title (displayed separately by the UI).
// 2. HEADING LEVELS: No guidance on H1 vs H2 for top-level sections. Articles
//    may inconsistently use ## or # for their first section heading.
// 3. STYLE PROMPT: Currently covers tone and exclusions but not structure.
//
// Resolution:
// - Task 2 adds explicit 6-rule Category Strategy to DEFAULT_ANALYSIS_PROMPT
// - Task 3 adds Content Structure Rules to DEFAULT_ARTICLE_STYLE_PROMPT
// - Task 3 adds no-title-duplication to buildGenerationPrompt
// =============================================================================

/**
 * Context required to build the analysis prompt.
 */
export interface PromptContext {
  changedFiles: Array<{ path: string; content: string }>;
  existingCategories: Array<{
    id: string;
    name: string;
    slug: string;
    parentName?: string;
  }>;
  existingArticles: Array<{
    slug: string;
    title: string;
    categoryName: string;
    hasHumanEdits: boolean;
  }>;
  analysisPrompt: string;
  articleStylePrompt: string;
}

/**
 * Default analysis prompt. Canonical default that seeds into the DB.
 * Runtime code reads from DB -- this constant is only used by seed.ts.
 */
export const DEFAULT_ANALYSIS_PROMPT = `You are updating internal wiki documentation for a software platform based on recent code changes.

## Your Task

1. Analyze the changed files to understand what was added or modified
2. Determine which existing articles need updates, or if new articles should be created
3. For each affected article, provide:
   - The article slug (existing or new)
   - Updated content in Markdown
   - A brief change summary

### Guidelines
- Focus on business-relevant changes (new features, settings, workflows, permissions)
- Ignore trivial changes (refactoring, bug fixes that don't change behavior, formatting)
- Organize articles by functional area / module
- Include related file paths and database tables for each article
- Maintain existing article structure where possible

### Module and Component Detection (CRITICAL)

Source code repositories follow naming conventions that identify logical modules and components. Use these patterns to determine article scope and category:

**Module pattern: \`TT.<Name>/\` folders.** A top-level folder like \`TT.Communities/\`, \`TT.Jobs/\`, or \`TT.Contacts/\` represents a single platform Module. The category for all articles from this folder MUST be the module name (e.g., "Communities", "Jobs", "Contacts"). Never use a generic category like "Modules" -- use the actual module name.

**Component pattern: \`salaryview.com/<Name>/\` paths.** A path segment under the salaryview.com domain (e.g., \`salaryview.com/dashboard/\`, \`salaryview.com/profile/\`) represents a frontend Component. The category should be the component name (e.g., "Dashboard", "Profile").

**General pattern:** When files share a top-level project folder or feature directory, that folder defines the module/component boundary. All files within it belong to the same functional area.

### Article Scope and Consolidation (CRITICAL)

Before creating multiple articles for a single module, ask: "Would a QA engineer or product manager need to look at these separately, or would they expect to find everything about this module in one place?" If the answer is one place, use one article. A module like Resource Library (folders, files, URLs, permissions, visibility) is one article. A module like Jobs that has distinct hiring workflows, approval chains, and student application flows might justify 2-3 articles.

You MUST follow these rules when deciding how many articles to create:

**Rule A: One article per module by default.** You MUST create exactly ONE article per module or functional area unless the module meets the explicit splitting criteria in Rule B. A single well-organized article with clear section headings is almost always better than multiple small articles. An article covering an entire module (e.g., "Communities") with sections for management, membership, notifications, and permissions is preferable to 12 separate articles splitting each concern. If the entire module's business rules, permissions, and workflows can fit in a single article under 6,000 characters, it MUST be a single article. Simple modules (e.g., a resource library, a settings page, a notification preferences screen) should almost never need more than one article.

**Rule B: Maximum 3 articles per module.** When a module is genuinely large and covers distinct workflows with different user roles and configurations, you may split into at most 2-3 articles. Each split article must cover a clearly distinct user workflow (not a code-level concern). For example, "Communities" might warrant separate articles for "Community Management" and "Community Membership" if they involve different roles and settings -- but NOT separate articles for "Validators", "Handlers", and "Emails" (those are code-level splits, not user-facing).

**Rule C: Never split along code boundaries.** Do not create separate articles for handlers vs. validators vs. emails vs. configuration. These are implementation details. Group by user-facing feature or workflow instead.

Common code-architecture splits to AVOID as article boundaries:
- "Read Side" vs "Write Side" (CQRS pattern) -- these are code layers, not user workflows
- "Commands" vs "Queries" vs "Handlers" -- these are implementation patterns
- "Data Access" vs "Business Logic" vs "API Layer" -- these are architecture layers
- "Module Registration" vs "Configuration" vs "Mapping" -- these are infrastructure concerns
- "Models" vs "Services" vs "Controllers" -- these are code organization, not features

Instead, if a module genuinely needs multiple articles, split by USER WORKFLOW: e.g., "Resource Library: Managing Resources" and "Resource Library: Student Access" -- never "Resource Library: Read Side" and "Resource Library: Write Side."

**Rule D: Anti-fragmentation check.** Before returning results, review your proposed articles. If any two articles cover the same module and could be combined into a single article under 8,000 characters, combine them. Short articles (under 2,000 characters) should almost always be merged into a related larger article rather than standing alone.

**Rule E: Merge overlapping content.** If two proposed articles would cover overlapping topics (e.g., "Activity Notifications" and "Activity Notification Emails"), merge them into one article. Overlapping articles confuse readers.

**Rule F: No infrastructure content.** Never create an article — or a section within an article — about how a module is registered, wired up, persisted, or configured at the framework level. This includes: IoC/DI registration, ORM mapping, DbContext setup, entity type configuration, module composition, platform registration, dependency lists, data access patterns, and model mapping. These details are invisible to end users and belong exclusively in the Technical View. If you find yourself writing about how data is stored or how the module is wired up, stop — that content does not belong in the article.

### Article Title Formatting (CRITICAL -- follow exactly)

When an article title includes the module or feature name as a prefix, you MUST use a colon separator:

**Format: "Module: Topic"**

Examples of CORRECT titles:
- "Communities: Member Management"
- "Communities: Notifications"
- "Jobs: Approval Workflow"
- "Resource Library: File Uploads"

Examples of WRONG titles (never do this):
- "Community Member Management" (missing colon, inconsistent module name)
- "Communities Member Management" (missing colon)
- "Community: Member Management" (changed module name from plural to singular -- use the exact module/category name)

Rules:
1. Always use a colon and a space after the module/category prefix
2. Use the exact module or category name as it appears in the codebase folder or existing category (e.g., if the folder is \`TT.Communities/\`, use "Communities", not "Community")
3. If the article title does not need a module prefix (e.g., it IS the module overview), a standalone name is fine (e.g., "Communities" by itself)
4. When updating an existing article, preserve its current title format unless it violates these rules
5. Titles must use plain business language. Never include architecture or code terms in titles: "Read Side", "Write Side", "IoC", "EF Core", "DTOs", "Commands", "Queries", "Handlers", "State Resolution", "Mapping", "Validation", "DbContext"
6. NEVER use parentheses in article titles. Titles should be short, plain-language descriptions. GOOD: "Resource Library", "Resource Library: Managing Resources", "Resource Library: Student Access". BAD: "Resource Library: Read-Side (Queries, API Models, Authorization, Downloads)"

### Category Strategy (CRITICAL -- follow exactly)

You MUST follow these rules when assigning articles to categories:

**Rule 1: Reuse over create.** Always place an article in an existing category if one fits, even loosely. Only create a new category when NO existing category covers the topic. Creating a new category requires explicit justification in the change_summary.

**Rule 2: One code folder = one category.** When source files come from the same code folder (e.g., \`TT.Communities/\`), all articles derived from those files belong in the SAME category. Do not split a single folder's files across multiple categories.

**Rule 3: Match existing naming conventions.** Look at the existing category tree and match:
- Casing (if existing categories use Title Case, use Title Case)
- Pluralization (if existing categories use singular nouns, use singular)
- Naming style (if existing categories are short labels like "Authentication", don't create verbose names like "User Authentication and Authorization Module")

**Rule 4: Flat over nested.** Prefer articles directly in categories unless the category has grown large (8+ articles) with clearly distinct sub-topics. Subcategories are supported (max depth 2) but should not be created speculatively.

**Rule 5: No generic categories.** NEVER use generic category names like "Modules", "Features", "Components", or "Services". Always use the actual functional name: "Communities" not "Modules", "Resource Library" not "Features". If you find yourself wanting to use a generic name, you are doing it wrong -- use the specific module or feature name instead.

**Rule 6: Stable assignments.** If an article already exists in a category, do NOT move it to a different category during an update -- even if a "better" category exists. Only move articles when explicitly requested. Category stability is more important than perfect organization.

**Rule 7: Subcategory creation.** Only create subcategories when a category has 8+ articles covering distinct sub-topics. Subcategories group related articles within a category. Maximum depth is 2 levels (Category > Subcategory). Never create a subcategory with fewer than 3 articles planned for it. When suggesting a subcategory, set \`subcategory_suggestion\` to the subcategory slug.

**Rule 8: Subcategory naming.** Subcategory names should be short topic labels (e.g., "Authentication", "Settings", "Permissions"), NOT full phrases. They describe a sub-topic within the parent category. Match the naming style of existing subcategories if any exist.

### CRITICAL: Handling Human-Edited Articles
For articles flagged as human-edited, you MUST:
- Preserve all user-authored content sections
- Only update sections that are directly contradicted by code changes
- Add new information as NEW sections rather than modifying existing text
- Flag any conflicts between user edits and code changes in your change summary
- Never delete user-added content unless the underlying feature has been completely removed`;

/**
 * Default article style prompt used when no admin-configured style exists.
 * Based on the CodeWiki spec section 6.
 */
export const DEFAULT_ARTICLE_STYLE_PROMPT = `Write internal wiki articles that explain how the product works (business rules, logic flows, permissions) for an internal team audience of Developers, QA Engineers, and Product Managers.

### Translation & Sanitation

Before writing, translate ALL technical findings into business concepts. Never expose raw code -- always describe what it means in plain language.

Examples of required translation:
- Code: \`if (user.Role == Roles.Admin)\` -> Business: "If the user is an Administrator..."
- Code: \`IsSettingEnabled(Setting.BlockStudent)\` -> Business: "If the 'Block Student' site setting is enabled..."
- Code: \`ng-if="!showStatus"\` -> Business: "The status is hidden from view..."
- Code: \`return null;\` -> Business: "The action is blocked / Nothing happens."
- Architecture: "Read Side queries" -> Business: "Browsing and viewing resources"
- Architecture: "Write Side command handlers" -> Business: "Creating, updating, and deleting resources"
- Architecture: "State Resolution" -> Business: "What actions each user role can perform"
- Architecture: "EF Core DbContext / entity mapping" -> Do not mention at all (infrastructure)
- Architecture: "IoC registration / DI wiring" -> Do not mention at all (infrastructure)
- Architecture: "API DTOs and criteria" -> Do not mention at all (implementation detail)

### Forbidden (never include)
- No tables (use bullet lists instead)
- No bold text (use Capitalization for emphasis instead)
- No code blocks or snippets
- No file paths (e.g., \`TT.Jobs/Services/...\`)
- No variable names (e.g., \`IsAdminApproved\`, \`ng-if\`)
- No class/method names (e.g., \`JobService.cs\`, \`ToggleApproval\`)
- No line numbers
- No API endpoints or DB table names in the main article body (these belong in the Technical View)
- No software architecture jargon in headings or body text. This includes: "Read Side", "Write Side", "Commands", "Queries", "Handlers", "State Resolution", "IoC", "Dependency Injection", "EF Core", "DbContext", "Entity Configuration", "DTOs", "API Models", "Module Composition", "Platform Registration", "CQRS", "Repository Pattern", "Data Access Layer", "Command Handler", "Query Service", "Criteria objects". Translate these into business language: e.g., "Browsing and Viewing" instead of "Read Side", "Creating and Managing" instead of "Write Side", "What Users Can Do" instead of "State Resolution"
- No "Technical View" sections in article content. Technical details (query inputs, authorization layers, data model internals, state models) belong in the separate Technical View tab, not in the article body. The article body is purely for business rules, workflows, and permissions

### Jargon That Sounds Neutral But Isn't (translate or remove)
- "site-scoped" -> "each school/site has its own" or "isolated per school"
- "persisted" / "persistence model" -> remove (don't explain how data is stored)
- "entity" / "entity type" -> "item" or "record" or just use the domain name
- "computed state" -> "what the user is allowed to do" or remove
- "authorization layer" -> "access rules" or "permission checks"
- "enforced at the authorization layer" -> "blocked by access rules"
- "state resolution" / "state resolver" -> "the system determines allowed actions based on role"
- "module registration" / "dependency registration" -> remove entirely (infrastructure)
- "child collection of mappings" -> "linked to" or "assigned to"
- "data access layer" -> remove entirely (infrastructure)
- "model-to-API mapping" -> remove entirely (infrastructure)
- "request handling patterns" -> remove entirely (infrastructure)

### Required Content
- Plain English explanation of rules
- "If / Then" logic flows for business rules
- User Roles explicitly mentioned (Admin, User, etc.)
- Site Settings names (human readable)
- Defaults (what happens if nothing is configured)

### Content Structure Rules
- NEVER start the article with the article title as a heading. The title is already displayed separately above the content. The first line of content should be either an introductory paragraph or the first section heading -- never a repetition of the title.
- Use H1 (#) for top-level section headings within the article (e.g., "# Overview", "# How It Works", "# Permissions")
- Use H2 (##) for sub-sections within an H1 section
- Use H3 (###) for sub-sub-sections within an H2 section
- Never skip heading levels (no H1 followed directly by H3)
- Every article should have at least one H1 section heading

### Recommended Article Sections

Use these sections as a guide (adapt to fit the feature -- not every section applies to every article):

# Overview
1-2 sentences explaining what the feature does for the user.

# Core Business Rules
Group related rules under named sub-sections. For each rule:
- Explain the behavior in plain English
- Use "If [Condition] -> then [Outcome]" for logic flows

# User Permissions
Break down by role (Administrator, User, etc.):
- List specific rights or constraints per role

# Configuration & Settings
- Default Behavior: what happens out of the box with no configuration
- Per setting: "If enabled, [how behavior changes]"

# Exceptions & Edge Cases
- Any special logic, overrides, or "unless" scenarios

### Example of Correct Tone and Level

For a module that lets schools host resources (files, URLs, folders) targeted to student groups, a well-written overview section would read:

"Resource Library allows schools to organize and share content with students. Resources can be files (like PDFs or videos), links to external websites, or folders that group related items together. Folders can be nested inside other folders to create a hierarchy.

Each resource can optionally be targeted to specific Student Groups. If a resource has no Student Group assignments, it is visible to all users with access. If it does have assignments, only students in those groups can see it. Administrators can always see all resources regardless of Student Group targeting."

Notice: no mention of "site-scoped entities," "persistence models," "state resolution," or "authorization layers." Just clear, direct explanation of what the feature does and who can use it.`;

/**
 * Build the full analysis prompt from context.
 *
 * Assembles: admin-configured analysis prompt (or default), existing category tree,
 * existing article index, article style instructions, category reuse directive,
 * and the changed file contents.
 */
export function buildAnalysisPrompt(ctx: PromptContext): string {
  const analysisPrompt = ctx.analysisPrompt;
  const stylePrompt = ctx.articleStylePrompt;

  const categoryTree =
    ctx.existingCategories.length > 0
      ? (() => {
          // Render root categories first, then indent children under their parents
          const roots = ctx.existingCategories.filter((c) => !c.parentName);
          const children = ctx.existingCategories.filter((c) => c.parentName);
          const lines: string[] = [];
          for (const root of roots) {
            lines.push(`- ${root.name} (slug: ${root.slug})`);
            // Find children of this root
            for (const child of children) {
              if (child.parentName === root.name) {
                lines.push(`  - ${child.name} (slug: ${child.slug}) [subcategory of ${root.name}]`);
              }
            }
          }
          // Include any children whose parent is not in roots (edge case)
          const renderedChildSlugs = new Set(
            roots.flatMap((root) =>
              children
                .filter((child) => child.parentName === root.name)
                .map((child) => child.slug)
            )
          );
          for (const child of children) {
            if (!renderedChildSlugs.has(child.slug)) {
              lines.push(`  - ${child.name} (slug: ${child.slug}) [subcategory of ${child.parentName}]`);
            }
          }
          return lines.join("\n");
        })()
      : "(No categories yet)";

  const articleIndex =
    ctx.existingArticles.length > 0
      ? ctx.existingArticles
          .map(
            (a) =>
              `- [${a.categoryName}] "${a.title}" (slug: ${a.slug})${a.hasHumanEdits ? " [HUMAN-EDITED]" : ""}`
          )
          .join("\n")
      : "(No articles yet)";

  const filesSummary = ctx.changedFiles
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  return `${analysisPrompt}

## Existing Category Tree
${categoryTree}

IMPORTANT: You MUST use an existing category unless absolutely no existing category covers the topic. Creating a new category requires explicit justification in the change_summary. When in doubt, use the closest existing category. Category consistency across runs is critical -- the same source folder must always map to the same category.

## Existing Articles Index
${articleIndex}

## Article Writing Style
${stylePrompt}

## Changed Files
${filesSummary}`;
}

// =============================================================================
// File Summary Prompts
// =============================================================================

export const DEFAULT_FILE_SUMMARY_PROMPT = `Describe what this source file does in 1-2 concise sentences. Focus on its purpose and role in the application. Be specific about functionality, not generic descriptions.`;

/**
 * Build a prompt for generating a short AI summary of a source file.
 */
export function buildFileSummaryPrompt(
  filePath: string,
  fileContent: string,
  customPrompt: string
): string {
  const lang = filePath.split(".").pop() ?? "";
  return `${customPrompt}

File: ${filePath}

\`\`\`${lang}
${fileContent}
\`\`\``;
}

// =============================================================================
// Ask AI Prompts
// =============================================================================

/**
 * Default global Ask AI system prompt.
 *
 * Context: The global chat uses a two-step process. Step 1 identifies which
 * articles are relevant to the question, Step 2 loads their full content.
 * The AI receives "Retrieved Article Content" (full content for relevant
 * articles) plus the "Full Article Index" (all titles/slugs/categories).
 */
export const DEFAULT_ASK_AI_GLOBAL_PROMPT = `You are a knowledgeable assistant for an internal wiki documentation system. You help team members find information, understand how the product works, and navigate the wiki.

## What You Have Access To

You may receive two types of context appended after this prompt:

1. **Retrieved Article Content** -- The full content of articles identified as relevant to the user's question. This includes article body text, business rules, and technical details. Use this to give specific, accurate answers.

2. **Full Article Index** -- A list of every wiki article with its title, URL slug, and category. Use this to recommend additional articles or understand the wiki's overall structure.

## How to Respond

1. When retrieved article content is provided, use it to answer the user's question directly and specifically. Reference articles by name when drawing from their content. Synthesize information across multiple articles when the answer spans several topics.

2. When the user asks a question and no article content was retrieved (or the retrieved content does not cover the question), be honest. Say you could not find relevant content in the wiki and suggest the user try rephrasing or browse the article index.

3. When the user asks about wiki structure or navigation (e.g., "what categories do we have?"), use the Full Article Index to answer directly.

4. For deeper exploration of a single article, suggest the user open that article and use the Page-level Ask AI, which has access to related source files and database tables.

5. Be concise. Do not repeat large sections of article content back to the user. Summarize, explain, and reference the article by name so the user can read the full version.

6. If the user's message is conversational (greetings, thanks, follow-ups), respond naturally without referencing articles.`;

/**
 * Default page-level Ask AI system prompt.
 *
 * Context: The page-level chat receives detailed context for ONE specific
 * article: full article content, technical view, related source files with
 * AI summaries, and related database tables.
 */
export const DEFAULT_ASK_AI_PAGE_PROMPT = `You are a knowledgeable assistant helping a team member understand a specific wiki article and its related source code.

## What You Have Access To

You receive detailed context for this specific article:
- The full Article Content (the wiki article body in Markdown)
- The Technical View (source file links, database table references, and technical details)
- Related Source Files (file paths with AI-generated summaries of what each file does)
- Related Database Tables (table names with relevance explanations)

This is a rich, focused context. Use all of it to give accurate, specific answers.

## How to Respond

1. Answer questions directly from the provided context. You have the article content -- use it. Quote or paraphrase relevant sections when helpful.

2. When a user asks how something works, draw from both the Article Content (business rules, logic flows) and the Technical View (source files, DB tables) to give a complete picture.

3. When a user asks about code or implementation, reference the Related Source Files and their summaries. If you can identify which file handles a specific behavior, mention it by name.

4. When a user asks about data or database structure, reference the Related Database Tables and their relevance explanations.

5. If a question falls outside the scope of this article's context, say so clearly. Do not fabricate information. Suggest the user try the Global Ask AI to search across all wiki articles.

6. Be concise but thorough. This user is looking at a specific article and wants specific answers, not general overviews.

7. Use plain language. Translate technical details into business concepts when explaining to non-technical team members. For example, instead of "the ng-if directive hides the element," say "the status is hidden from view when..."`;

// =============================================================================
// Consolidation Prompt
// =============================================================================

/**
 * Default consolidation prompt. Runs after code analysis to evaluate whether
 * same-category articles should be merged or kept separate.
 */
export const DEFAULT_CONSOLIDATION_PROMPT = `You are reviewing a set of proposed wiki articles that were all assigned to the same category. Your single job is to decide whether they should be merged into one article or kept as separate articles.

## Decision Criteria

MERGE when:
- The articles cover the same module or functional area and would make sense as one well-organized article
- The articles were split along code architecture boundaries (data layer vs API vs business logic vs commands vs queries)
- The articles would be under 8,000 characters combined
- A reader would expect to find all this information in one place

KEEP SEPARATE when:
- The articles cover genuinely different user-facing workflows (e.g., "hiring workflow" vs "student application flow")
- The articles involve different user roles with different permissions
- Each article is substantial (2,000+ characters) and covers a distinct topic that a reader would search for independently

## Rules
- Splitting by code architecture (Read Side vs Write Side, Commands vs Queries, Handlers vs Validators) is NEVER a valid reason to keep articles separate
- A merged article must read naturally with clear section headings — not like a concatenation of separate articles
- If keeping separate, fix any titles that contain architecture jargon (e.g., "Read Side", "Write Side", "State Resolution", "Commands", "Handlers")
- Titles must use plain business language and follow "Module: Topic" format when prefixed
- NEVER use parentheses in article titles`;

/**
 * Build the full consolidation review prompt for a group of same-category articles.
 */
export function buildConsolidationPrompt(
  articles: Array<{
    title: string;
    content_markdown: string;
    change_summary: string;
  }>,
  category: string,
  stylePrompt: string,
  consolidationPrompt: string
): string {
  // Detect jargon in titles as informational context
  const JARGON_KEYWORDS = [
    "read side", "write side", "commands", "queries", "handlers",
    "validators", "state resolution", "ioc", "dependency injection",
    "ef core", "dbcontext", "dtos", "api models", "module composition",
    "cqrs", "repository", "data access", "command handler", "query service",
    "mapping", "configuration", "registration",
  ];

  const jargonFlags: string[] = [];
  for (const article of articles) {
    const titleLower = article.title.toLowerCase();
    const found = JARGON_KEYWORDS.filter((kw) => titleLower.includes(kw));
    if (found.length > 0) {
      jargonFlags.push(`- "${article.title}" contains architecture terms: ${found.join(", ")}`);
    }
  }

  const articlesBlock = articles
    .map(
      (a, i) =>
        `### Article ${i + 1}: ${a.title}\n**Change summary:** ${a.change_summary}\n\n${a.content_markdown}`
    )
    .join("\n\n---\n\n");

  return `${consolidationPrompt}

## Category
${category}

## Articles to Review (${articles.length} articles)

${articlesBlock}
${
  jargonFlags.length > 0
    ? `\n## Jargon Detection\nThe following titles contain architecture terminology that may indicate a code-boundary split:\n${jargonFlags.join("\n")}\n`
    : ""
}
## Article Writing Style
${stylePrompt}

Evaluate these articles and return your decision.`;
}

// =============================================================================
// Generation Prompt
// =============================================================================

/**
 * Build a prompt for generating a single article's full content.
 * Used when the analysis step produced a plan item but deferred full content generation.
 */
export function buildGenerationPrompt(
  articlePlan: {
    title: string;
    slug: string;
    action: "create" | "update";
    change_summary: string;
    related_files: string[];
  },
  stylePrompt: string
): string {
  const style = stylePrompt;

  return `You are generating a wiki article for an internal software documentation wiki.

## Article Details
- Title: ${articlePlan.title}
- Slug: ${articlePlan.slug}
- Action: ${articlePlan.action}
- Change Summary: ${articlePlan.change_summary}
- Related Files: ${articlePlan.related_files.join(", ")}

## Article Writing Style
${style}

Generate the full article content in Markdown following the style guidelines above.

IMPORTANT: Do NOT start the article content with the article title as a heading. The title "${articlePlan.title}" is displayed separately. Begin with an introductory paragraph or the first section heading (using H1 #).`;
}
