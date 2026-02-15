import { z } from "zod/v4";
import { generateText, Output, type LanguageModel } from "ai";
import type { UsageTracker } from "./usage";

// ---------------------------------------------------------------------------
// Schema — original (used by analyze.ts type import)
// ---------------------------------------------------------------------------

export const planResponseSchema = z.object({
  groups: z.array(
    z.object({
      id: z.string().describe("Kebab-case group identifier"),
      description: z
        .string()
        .describe("Short description of this group's functional area"),
      files: z
        .array(z.string())
        .describe("File paths assigned to this group"),
      proposed_articles: z.array(
        z.object({
          title: z.string().describe("Proposed article title"),
          slug: z.string().describe("URL-safe article slug"),
          action: z
            .enum(["create", "update"])
            .describe("Whether to create or update"),
          scope: z
            .string()
            .describe("What this article should cover from this group"),
        })
      ),
    })
  ),
  rationale: z
    .string()
    .describe("Brief explanation of the grouping strategy"),
});

export type PlanResponse = z.infer<typeof planResponseSchema>;

// ---------------------------------------------------------------------------
// Schema — raw LLM response (directory patterns, not individual files)
// ---------------------------------------------------------------------------

const rawPlanResponseSchema = z.object({
  groups: z.array(
    z.object({
      id: z.string().describe("Kebab-case group identifier"),
      description: z
        .string()
        .describe("Short description of this group's functional area"),
      directory_patterns: z
        .array(z.string())
        .describe(
          "Directory prefixes covered by this group (e.g. 'TT.Jobs/Services/', 'TT.Jobs/Models/')"
        ),
      proposed_articles: z.array(
        z.object({
          title: z.string().describe("Proposed article title"),
          slug: z.string().describe("URL-safe article slug"),
          action: z
            .enum(["create", "update"])
            .describe("Whether to create or update"),
          scope: z
            .string()
            .describe("What this article should cover from this group"),
        })
      ),
    })
  ),
  shared_context_patterns: z
    .array(z.string())
    .describe(
      "Directory prefixes for shared infrastructure/utility files — used as read-only context, no articles generated"
    ),
  rationale: z
    .string()
    .describe("Brief explanation of the grouping strategy"),
});

type RawPlanResponse = z.infer<typeof rawPlanResponseSchema>;

// ---------------------------------------------------------------------------
// Types — directory compression + expanded plan
// ---------------------------------------------------------------------------

export interface DirectorySummary {
  prefix: string;
  fileCount: number;
  keyFiles: Array<{ path: string; summary: string }>;
  allFiles: string[];
  linkedArticles: Array<{ slug: string; title: string; categoryName: string }>;
}

export interface ExpandedPlan extends PlanResponse {
  sharedContextFiles: string[];
}

export type ArticleLinksMap = Map<
  string,
  Array<{ slug: string; title: string; categoryName: string }>
>;

// ---------------------------------------------------------------------------
// Directory Compression
// ---------------------------------------------------------------------------

/**
 * Compress file summaries into directory-level entries for the planning prompt.
 *
 * - Groups files by directory path (everything before the last `/`)
 * - Merges small groups (<3 files) into their parent directory
 * - Splits large groups (>30 files) by one more path segment
 * - Picks top 5 key files per group (longest summaries first)
 * - Aggregates linked articles from the articleLinksMap
 */
export function compressForPlanning(
  fileSummaries: Array<{ path: string; summary: string }>,
  articleLinksMap: ArticleLinksMap
): DirectorySummary[] {
  // Step 1: group by directory
  const dirMap = new Map<
    string,
    Array<{ path: string; summary: string }>
  >();
  for (const f of fileSummaries) {
    const lastSlash = f.path.lastIndexOf("/");
    const dir = lastSlash >= 0 ? f.path.slice(0, lastSlash + 1) : "";
    const existing = dirMap.get(dir);
    if (existing) {
      existing.push(f);
    } else {
      dirMap.set(dir, [f]);
    }
  }

  // Step 2: merge small directories (<3 files) into parent
  const merged = new Map<
    string,
    Array<{ path: string; summary: string }>
  >();

  for (const [dir, files] of dirMap) {
    if (files.length < 3 && dir.length > 0) {
      // Find parent: strip trailing slash, then find last slash
      const trimmed = dir.slice(0, -1);
      const parentSlash = trimmed.lastIndexOf("/");
      const parentDir =
        parentSlash >= 0 ? trimmed.slice(0, parentSlash + 1) : "";

      const existing = merged.get(parentDir);
      if (existing) {
        existing.push(...files);
      } else {
        merged.set(parentDir, [...files]);
      }
    } else {
      const existing = merged.get(dir);
      if (existing) {
        existing.push(...files);
      } else {
        merged.set(dir, [...files]);
      }
    }
  }

  // Step 3: split large directories (>30 files) by one more segment
  const final = new Map<
    string,
    Array<{ path: string; summary: string }>
  >();

  for (const [dir, files] of merged) {
    if (files.length > 30) {
      // Sub-group by next path segment
      const subMap = new Map<
        string,
        Array<{ path: string; summary: string }>
      >();

      for (const f of files) {
        const rest = f.path.slice(dir.length);
        const nextSlash = rest.indexOf("/");
        const subDir =
          nextSlash >= 0 ? dir + rest.slice(0, nextSlash + 1) : dir;

        const existing = subMap.get(subDir);
        if (existing) {
          existing.push(f);
        } else {
          subMap.set(subDir, [f]);
        }
      }

      for (const [subDir, subFiles] of subMap) {
        const existing = final.get(subDir);
        if (existing) {
          existing.push(...subFiles);
        } else {
          final.set(subDir, [...subFiles]);
        }
      }
    } else {
      const existing = final.get(dir);
      if (existing) {
        existing.push(...files);
      } else {
        final.set(dir, [...files]);
      }
    }
  }

  // Step 4: build DirectorySummary[]
  const summaries: DirectorySummary[] = [];

  for (const [prefix, files] of final) {
    // Top 5 key files by summary length (longest = most informative)
    const sorted = [...files].sort(
      (a, b) => b.summary.length - a.summary.length
    );
    const keyFiles = sorted.slice(0, 5);

    // Aggregate linked articles (deduplicated by slug)
    const articleSeen = new Set<string>();
    const linkedArticles: DirectorySummary["linkedArticles"] = [];
    for (const f of files) {
      const links = articleLinksMap.get(f.path);
      if (links) {
        for (const link of links) {
          if (!articleSeen.has(link.slug)) {
            articleSeen.add(link.slug);
            linkedArticles.push(link);
          }
        }
      }
    }

    summaries.push({
      prefix: prefix || "(root)",
      fileCount: files.length,
      keyFiles,
      allFiles: files.map((f) => f.path),
      linkedArticles,
    });
  }

  return summaries.sort((a, b) => a.prefix.localeCompare(b.prefix));
}

// ---------------------------------------------------------------------------
// Plan Expansion
// ---------------------------------------------------------------------------

/**
 * Expand a raw LLM plan (directory patterns) into concrete file lists.
 *
 * - For each group: expand directory_patterns to actual file paths via startsWith matching
 * - Resolve shared_context_patterns to sharedContextFiles
 * - Unmatched files get assigned to best-matching group by longest common prefix
 * - Shared files are excluded from group assignment
 */
export function expandPlan(
  rawPlan: RawPlanResponse,
  fileSummaries: Array<{ path: string; summary: string }>
): ExpandedPlan {
  const allPaths = fileSummaries.map((f) => f.path);

  // Resolve shared context files first
  const sharedContextFiles: string[] = [];
  const sharedSet = new Set<string>();
  for (const pattern of rawPlan.shared_context_patterns) {
    for (const path of allPaths) {
      if (path.startsWith(pattern) && !sharedSet.has(path)) {
        sharedSet.add(path);
        sharedContextFiles.push(path);
      }
    }
  }

  // Expand groups
  const assignedFiles = new Set<string>(sharedSet);
  const groups: PlanResponse["groups"] = rawPlan.groups.map((group) => {
    const files: string[] = [];
    for (const pattern of group.directory_patterns) {
      for (const path of allPaths) {
        if (path.startsWith(pattern) && !assignedFiles.has(path)) {
          assignedFiles.add(path);
          files.push(path);
        }
      }
    }
    return {
      id: group.id,
      description: group.description,
      files,
      proposed_articles: group.proposed_articles,
    };
  });

  // Assign unmatched files to best-matching group by longest common prefix
  const unmatched = allPaths.filter((p) => !assignedFiles.has(p));
  for (const path of unmatched) {
    let bestGroupIdx = 0;
    let bestLen = 0;

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      // Check longest common prefix against any file already in the group
      for (const existingFile of group.files) {
        let commonLen = 0;
        const max = Math.min(path.length, existingFile.length);
        for (let c = 0; c < max; c++) {
          if (path[c] === existingFile[c]) commonLen++;
          else break;
        }
        if (commonLen > bestLen) {
          bestLen = commonLen;
          bestGroupIdx = i;
        }
      }
    }

    if (groups.length > 0) {
      groups[bestGroupIdx].files.push(path);
    }
  }

  return {
    groups,
    sharedContextFiles,
    rationale: rawPlan.rationale,
  };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export function buildPlanningPrompt(
  directorySummaries: DirectorySummary[],
  categoryTree: Array<{
    id: string;
    name: string;
    slug: string;
    parentName?: string;
  }>,
  articleIndex: Array<{
    slug: string;
    title: string;
    categoryName: string;
    hasHumanEdits: boolean;
  }>
): string {
  const dirLines: string[] = [];
  for (const dir of directorySummaries) {
    dirLines.push(`- **${dir.prefix}** (${dir.fileCount} files)`);

    if (dir.linkedArticles.length > 0) {
      const articleList = dir.linkedArticles
        .map((a) => `"${a.title}" (${a.slug})`)
        .join(", ");
      dirLines.push(`  Linked articles: ${articleList}`);
    }

    dirLines.push("  Key files:");
    for (const f of dir.keyFiles) {
      dirLines.push(`    - ${f.path}: ${f.summary}`);
    }

    if (dir.fileCount > dir.keyFiles.length) {
      dirLines.push(
        `    ...and ${dir.fileCount - dir.keyFiles.length} more`
      );
    }
  }

  const directoriesSection = dirLines.join("\n");

  const categorySection =
    categoryTree.length > 0
      ? (() => {
          const roots = categoryTree.filter((c) => !c.parentName);
          const children = categoryTree.filter((c) => c.parentName);
          const lines: string[] = [];
          for (const root of roots) {
            lines.push(`- ${root.name} (slug: ${root.slug})`);
            for (const child of children) {
              if (child.parentName === root.name) {
                lines.push(`  - ${child.name} (slug: ${child.slug}) [subcategory of ${root.name}]`);
              }
            }
          }
          // Include children whose parent is not in roots (edge case)
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

  const articleSection =
    articleIndex.length > 0
      ? articleIndex
          .map(
            (a) =>
              `- [${a.categoryName}] "${a.title}" (slug: ${a.slug})${a.hasHumanEdits ? " [HUMAN-EDITED]" : ""}`
          )
          .join("\n")
      : "(No articles yet)";

  return `You are a planning assistant for an internal wiki documentation system. Your job is to organize a large set of source directories into coherent groups for wiki article generation.

## Source Directories (compressed view)
${directoriesSection}

## Existing Category Tree
${categorySection}

## Existing Articles Index
${articleSection}

## Grouping Rules (follow exactly)

1. **Group by directory prefix.** Output \`directory_patterns\` (e.g. "TT.Jobs/Services/", "TT.Jobs/Models/"), NOT individual file paths. Every file under a matched prefix joins the group.

2. **Match existing articles.** Directories with linked articles should propose \`"action": "update"\` for those articles, not create new duplicates. Always prefer updating an existing article over creating a new one for the same content.

3. **Consolidate aggressively.** Target 5-15 groups total. Fewer, larger groups are better than many small groups. A single group covering an entire module is preferred over splitting by code-level concerns.

4. **Maximum 3 articles per group.** Each group should propose 1-3 articles. If a group needs more, split along user-facing workflow boundaries.

5. **Shared context.** Infrastructure, utility, and configuration directories that are referenced by multiple modules go in \`shared_context_patterns\`. These provide read-only context during analysis — NO articles are generated for them.

6. **No orphan directories.** Every directory must be covered by either a group's \`directory_patterns\` or \`shared_context_patterns\`.

7. **Category alignment.** All articles in a group should belong to the same category. Split groups that would span multiple categories.

8. **Kebab-case IDs.** Group IDs must be kebab-case (e.g. "user-authentication", "job-management").

9. **Subcategory awareness.** If the existing category tree shows subcategories (indented under a parent), propose articles into the appropriate subcategory when it fits. Do not create new subcategories in the planning stage — that decision is made during analysis.

Return a JSON plan with groups, shared_context_patterns, and a brief rationale for the overall strategy.`;
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function planGroups(
  fileSummaries: Array<{ path: string; summary: string }>,
  categoryTree: Array<{
    id: string;
    name: string;
    slug: string;
    parentName?: string;
  }>,
  articleIndex: Array<{
    slug: string;
    title: string;
    categoryName: string;
    hasHumanEdits: boolean;
  }>,
  model: LanguageModel,
  articleLinksMap?: ArticleLinksMap,
  usageTracker?: UsageTracker
): Promise<ExpandedPlan> {
  const linksMap = articleLinksMap ?? new Map();

  // Compress file summaries into directory-level entries
  const directorySummaries = compressForPlanning(fileSummaries, linksMap);

  const prompt = buildPlanningPrompt(
    directorySummaries,
    categoryTree,
    articleIndex
  );

  const { experimental_output, usage, providerMetadata } = await generateText({
    model,
    temperature: 0.2,
    output: Output.object({ schema: rawPlanResponseSchema }),
    messages: [
      {
        role: "system",
        content:
          "You are a planning assistant that organizes source directories into groups for wiki article generation. Always respond with valid JSON matching the required schema.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  usageTracker?.add(usage, providerMetadata);

  if (!experimental_output) {
    return {
      groups: [],
      sharedContextFiles: [],
      rationale: "Planning call returned no output.",
    };
  }

  return expandPlan(experimental_output, fileSummaries);
}
