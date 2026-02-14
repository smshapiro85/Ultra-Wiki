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
 * Default analysis prompt used when no admin-configured prompt exists.
 * Based on the CodeWiki spec section 6.
 */
const DEFAULT_ANALYSIS_PROMPT = `You are updating internal wiki documentation for a software platform based on recent code changes.

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

### Category Strategy (CRITICAL -- follow exactly)

You MUST follow these rules when assigning articles to categories:

**Rule 1: Reuse over create.** Always place an article in an existing category if one fits, even loosely. Only create a new category when NO existing category covers the topic. Creating a new category requires explicit justification in the change_summary.

**Rule 2: One code folder = one category.** When source files come from the same code folder (e.g., \`src/features/resource-library/\`), all articles derived from those files belong in the SAME category. Do not split a single folder's files across multiple categories. Do not create a separate category for each file.

**Rule 3: Match existing naming conventions.** Look at the existing category tree and match:
- Casing (if existing categories use Title Case, use Title Case)
- Pluralization (if existing categories use singular nouns, use singular)
- Naming style (if existing categories are short labels like "Authentication", don't create verbose names like "User Authentication and Authorization Module")

**Rule 4: Flat over nested.** Prefer top-level categories unless there is an existing parent-child pattern that clearly fits. Do not create subcategory hierarchies speculatively.

**Rule 5: No generic parents.** Do not create generic parent categories like "Modules", "Features", or "Components" to group other categories. Each functional area is a top-level category.

**Rule 6: Stable assignments.** If an article already exists in a category, do NOT move it to a different category during an update -- even if a "better" category exists. Only move articles when explicitly requested. Category stability is more important than perfect organization.

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
const DEFAULT_ARTICLE_STYLE_PROMPT = `Write internal wiki articles that explain how the product works (business rules, logic flows, permissions) for an internal team audience of Developers, QA Engineers, and Product Managers.

### Output Rules
- No code blocks or snippets in the article body
- No file paths, variable names, class/method names, or line numbers in the article body
- No API endpoints or DB table names in the main article body (these belong in the Technical View)
- Use plain English explanation of rules
- Use "If / Then" logic flows for business rules
- Mention User Roles explicitly (Admin, User, etc.)
- Mention Site Settings names (human readable)
- Document defaults (what happens if nothing is configured)`;

/**
 * Build the full analysis prompt from context.
 *
 * Assembles: admin-configured analysis prompt (or default), existing category tree,
 * existing article index, article style instructions, category reuse directive,
 * and the changed file contents.
 */
export function buildAnalysisPrompt(ctx: PromptContext): string {
  const analysisPrompt = ctx.analysisPrompt || DEFAULT_ANALYSIS_PROMPT;
  const stylePrompt = ctx.articleStylePrompt || DEFAULT_ARTICLE_STYLE_PROMPT;

  const categoryTree =
    ctx.existingCategories.length > 0
      ? ctx.existingCategories
          .map(
            (c) =>
              `- ${c.parentName ? `${c.parentName} > ` : ""}${c.name} (slug: ${c.slug})`
          )
          .join("\n")
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

const DEFAULT_FILE_SUMMARY_PROMPT = `Describe what this source file does in 1-2 concise sentences. Focus on its purpose and role in the application. Be specific about functionality, not generic descriptions.`;

/**
 * Build a prompt for generating a short AI summary of a source file.
 */
export function buildFileSummaryPrompt(
  filePath: string,
  fileContent: string,
  customPrompt: string
): string {
  const lang = filePath.split(".").pop() ?? "";
  return `${customPrompt || DEFAULT_FILE_SUMMARY_PROMPT}

File: ${filePath}

\`\`\`${lang}
${fileContent}
\`\`\``;
}

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
  const style = stylePrompt || DEFAULT_ARTICLE_STYLE_PROMPT;

  return `You are generating a wiki article for an internal software documentation wiki.

## Article Details
- Title: ${articlePlan.title}
- Slug: ${articlePlan.slug}
- Action: ${articlePlan.action}
- Change Summary: ${articlePlan.change_summary}
- Related Files: ${articlePlan.related_files.join(", ")}

## Article Writing Style
${style}

Generate the full article content in Markdown following the style guidelines above.`;
}
