import { Octokit } from "@octokit/rest";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TreeFile {
  path: string;
  sha: string;
  size: number;
  type: "blob" | "tree";
}

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

// ---------------------------------------------------------------------------
// Tree Fetching
// ---------------------------------------------------------------------------

/**
 * Fetch the full recursive file tree for a repository branch.
 * Returns both blobs (files) and trees (directories) so the UI can render
 * a complete hierarchical file browser.
 */
export async function fetchRepoTree(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<TreeFile[]> {
  // Resolve branch HEAD SHA
  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  const commitSha = ref.object.sha;

  // Fetch the full recursive tree
  const { data: tree } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: commitSha,
    recursive: "true",
  });

  if (tree.truncated) {
    console.warn(
      "GitHub tree response was truncated. The repository may have more than 100,000 entries."
    );
  }

  return tree.tree
    .filter(
      (item): item is typeof item & { path: string; sha: string } =>
        (item.type === "blob" || item.type === "tree") &&
        item.path != null &&
        item.sha != null
    )
    .map((item) => ({
      path: item.path!,
      sha: item.sha!,
      size: item.size ?? 0,
      type: item.type as "blob" | "tree",
    }));
}

// ---------------------------------------------------------------------------
// Path Inclusion Logic
// ---------------------------------------------------------------------------

/**
 * Check whether a file path is included based on the inclusion patterns.
 *
 * Logic:
 *   (a) Exact match: filePath === pattern
 *   (b) Child of included dir: filePath starts with pattern + "/"
 *   (c) Ancestor of included path: a pattern starts with filePath + "/"
 *       (needed so parent directories remain visible in the tree)
 *
 * If includedPatterns is empty, nothing is included (all excluded by default).
 */
export function isPathIncluded(
  filePath: string,
  includedPatterns: string[]
): boolean {
  if (includedPatterns.length === 0) return false;

  for (const pattern of includedPatterns) {
    // (a) exact match
    if (filePath === pattern) return true;
    // (b) file is inside an included directory
    if (filePath.startsWith(pattern + "/")) return true;
    // (c) file is an ancestor directory of an included path
    if (pattern.startsWith(filePath + "/")) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Tree Structure Builder
// ---------------------------------------------------------------------------

/**
 * Convert a flat list of TreeFiles into a nested tree structure suitable
 * for rendering in the UI.
 *
 * Sorts directories first, then files, both alphabetically.
 */
export function buildTreeStructure(files: TreeFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  // Map from directory path -> TreeNode for efficient lookups
  const dirMap = new Map<string, TreeNode>();

  // Sort so directories come first, then files, alphabetically within each group
  const sorted = [...files].sort((a, b) => {
    if (a.type === "tree" && b.type !== "tree") return -1;
    if (a.type !== "tree" && b.type === "tree") return 1;
    return a.path.localeCompare(b.path);
  });

  // First pass: create all directory nodes
  for (const file of sorted) {
    if (file.type === "tree") {
      const node: TreeNode = {
        name: file.path.split("/").pop()!,
        path: file.path,
        type: "directory",
        children: [],
      };
      dirMap.set(file.path, node);
    }
  }

  // Second pass: create file nodes and place everything in the tree
  for (const file of sorted) {
    const node: TreeNode =
      file.type === "tree"
        ? dirMap.get(file.path)!
        : {
            name: file.path.split("/").pop()!,
            path: file.path,
            type: "file",
          };

    const parentPath = file.path.includes("/")
      ? file.path.substring(0, file.path.lastIndexOf("/"))
      : null;

    if (parentPath && dirMap.has(parentPath)) {
      dirMap.get(parentPath)!.children!.push(node);
    } else {
      root.push(node);
    }
  }

  // Sort children within each directory: directories first, then files, alphabetically
  function sortChildren(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.type === "directory" && b.type !== "directory") return -1;
      if (a.type !== "directory" && b.type === "directory") return 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children) {
        sortChildren(node.children);
      }
    }
  }

  sortChildren(root);
  return root;
}
