# AI Article Generation Pipeline

Ultra Wiki's AI pipeline converts source code files from your GitHub repository into structured wiki articles. This document explains how the pipeline decides which files go together, how it communicates with the LLM, and how it handles large repositories.

## Pipeline Modes

The pipeline has two modes based on the size of the incoming change set:

- **Fast path** (25 or fewer files, under 50K total chars): Sends all files directly to the analysis LLM in a single call. No planning stage needed.
- **Multi-stage pipeline** (26+ files or over 50K chars): Runs the full 3-stage process described below.

## Multi-Stage Pipeline Overview

```
Stage 1: Summarize all files         (cheap/fast model, concurrent)
     |
Pre-Stage 2: Resolve article links   (database query)
     |
Stage 2: Plan groups                 (analysis model, 1 LLM call)
     |
Stage 3: Analyze each group          (analysis model, concurrent)
     |
Post: Generate & persist articles
```

## Stage 1: File Summarization

Every source file is summarized into a 1-2 sentence description using the configured summary model (typically a fast, inexpensive model).

- Runs with concurrency of 5
- Each summary is saved to the `github_files.ai_summary` column
- If the summary model isn't configured, falls back to `"Source file at <path>"`
- Output: `{path, summary}[]` for every file

## Pre-Stage 2: Resolve Existing Article Links

Before planning, the pipeline queries the database to find which files are already linked to existing wiki articles.

- Joins `github_files` -> `article_file_links` -> `articles` with category lookup
- Chunks queries in batches of 500 for very large file sets
- Output: A map of `filePath -> [{slug, title, categoryName}]`

This information flows into both Stage 2 (so the planner knows which directories already have articles) and Stage 3 (so the analyzer prefers updating existing articles).

## Stage 2: Planning

The planning stage organizes hundreds of files into 5-15 coherent groups. It uses **directory-level compression** to keep the prompt small even with 1000+ files.

### Directory Compression

Instead of listing every file individually (which would blow the context window), files are compressed into directory summaries:

1. **Group by directory** - Files are grouped by their parent directory path
2. **Merge small directories** - Directories with fewer than 3 files get merged into their parent directory
3. **Split large directories** - Directories with more than 30 files are split by the next path segment
4. **Key file selection** - Each directory shows only its top 5 most informative files (by summary length)
5. **Article aggregation** - Linked articles from the pre-stage query are shown per directory

A directory entry in the planning prompt looks like:

```
- **TT.Jobs/Services/** (53 files)
  Linked articles: "Job Management" (job-management), "Job Search" (job-search)
  Key files:
    - TT.Jobs/Services/JobService.cs: Handles job CRUD operations
    - TT.Jobs/Services/JobValidator.cs: Validates job submissions
    ...and 48 more
```

This compresses 500+ individual file listings (~40K chars) into ~20-30 directory entries (~5K chars).

### Planning Schema

The LLM returns a structured plan with:

- **groups** - Each group has:
  - `id`: Kebab-case identifier (e.g. "job-management")
  - `description`: What this group covers
  - `directory_patterns`: Directory prefixes that belong to this group (e.g. `["TT.Jobs/Services/", "TT.Jobs/Models/"]`)
  - `proposed_articles`: 1-3 articles to create or update, each with title, slug, action, and scope
- **shared_context_patterns** - Directory prefixes for infrastructure/utility code that shouldn't generate articles but provides context
- **rationale** - Brief explanation of the grouping strategy

### Plan Expansion

After the LLM returns directory patterns, the pipeline expands them into concrete file lists:

1. Shared context patterns are resolved first (these files are excluded from groups)
2. Each group's `directory_patterns` are matched against actual file paths using `startsWith`
3. Any unmatched files are assigned to the best-matching group by longest common prefix

The result is an `ExpandedPlan` with the same shape as before (`groups[]{files[]}`) plus a `sharedContextFiles[]` list.

### Planning Rules

The LLM follows these rules when creating groups:

1. Group by directory prefix, not individual files
2. Prefer updating existing linked articles over creating new ones
3. Consolidate aggressively (target 5-15 groups)
4. Maximum 3 articles per group
5. Put infrastructure/utility directories in shared context (no articles)
6. Every directory must be covered by a group or shared context
7. All articles in a group should align to the same category
8. Use kebab-case group IDs

## Stage 3: Group Analysis

Each group is analyzed independently with the full analysis model. Groups run with concurrency of 2.

### Compact Plan Context

Each group's LLM call includes context about the overall plan, but uses compact summaries for other groups:

- **Current group**: Full detail (file list, proposed articles with scope)
- **Other groups**: One-line summary each: `- **group-id**: description -- Articles: "Title 1", "Title 2" (N files)`

This reduces plan context from ~15-30K chars to ~3.5K chars for 30 groups.

### Shared Context Injection

If the plan identified shared context files (infrastructure, utilities, configs), their summaries are injected as a "Shared Context (read-only)" section. The LLM is told these are reference-only and should not generate articles about them.

### Existing Article Links

Files that already have linked articles get an "Existing Article Links" section in the prompt, mapping each file to its current articles. This tells the LLM to prefer updating those articles rather than creating new duplicates.

### Sub-batching

If a single group has too many files for one LLM call (over 25 files or 50K chars of content), it's sub-batched internally. Results from sub-batches are merged, deduplicating articles by slug.

## Post-Analysis: Article Processing

After all groups are analyzed, the pipeline processes each proposed article:

- **Create**: Generates full content, creates the article record, populates file links and DB table references
- **Update**: Looks up the existing article. If it has no human edits, overwrites directly. If it has human edits, runs a three-way merge to preserve human changes while incorporating AI updates.

## Category Strategy

The analysis prompt includes 6 deterministic category rules (added in Phase 8):

1. **Reuse over create** — Always prefer existing categories
2. **One folder = one category** — Map directory structure to categories
3. **Match naming conventions** — Use the repository's folder names as category names
4. **Flat over nested** — Avoid deep category hierarchies
5. **No generic categories** — Categories like "Utilities" or "Helpers" are discouraged
6. **Stable assignments** — Don't reassign articles to different categories on re-analysis

## Article Style Rules

The article style prompt enforces:

- **No title duplication** — Articles must not start with their title as a heading
- **H1 for top-level sections** — `#` headings are used for major article sections
- **H2/H3 for subsections** — Never skip heading levels
- **No code in article body** — File paths, variable names, class names, and code blocks are forbidden (those belong in the Technical View)
- **Business language** — All technical concepts are translated to plain English

## Configuration

The pipeline behavior is controlled by settings in Admin > AI Prompts:

- **Analysis Prompt**: Custom instructions for the analysis LLM (includes category strategy and scope rules)
- **Article Style Prompt**: Style guidance for article content generation (includes heading hierarchy and formatting rules)
- **File Summary Prompt**: Custom instructions for the Stage 1 summary model

Each prompt has its own model and reasoning effort setting, allowing different models for different stages (e.g., a fast model for summaries, a capable model for analysis).

## Scaling Characteristics

| File Count | Planning Prompt Size | Stage 3 Context | Groups |
|-----------|---------------------|-----------------|--------|
| 50 | ~3K chars | ~2K chars | 3-8 |
| 200 | ~5K chars | ~3K chars | 8-12 |
| 500 | ~8K chars | ~3.5K chars | 10-15 |
| 1000+ | ~12K chars | ~4K chars | 12-15 |

The key insight is that prompt size grows with the number of *directories*, not the number of *files*. A repository with 1000 files typically has 30-50 distinct directories, which compress down to 20-30 entries after merging.
