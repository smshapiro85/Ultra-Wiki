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

IMPORTANT: You MUST use an existing category unless no existing category fits. Creating a new category requires justification in the change_summary. Prefer placing articles in existing categories to maintain a clean wiki structure.

## Existing Articles Index
${articleIndex}

## Article Writing Style
${stylePrompt}

## Changed Files
${filesSummary}`;
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
