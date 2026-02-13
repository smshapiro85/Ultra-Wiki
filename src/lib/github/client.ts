import { Octokit } from "@octokit/rest";
import { getSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/settings/constants";

/**
 * Create an authenticated Octokit instance using the stored GitHub API key.
 * Always creates a fresh instance so it picks up key changes.
 */
export async function getOctokit(): Promise<Octokit> {
  const token = await getSetting(SETTING_KEYS.github_api_key);
  if (!token) {
    throw new Error(
      "GitHub API key not configured. Please set it in Admin > Settings."
    );
  }
  return new Octokit({ auth: token });
}

/**
 * Parse a GitHub repository URL into owner and repo.
 * Supports formats:
 *   - https://github.com/owner/repo
 *   - https://github.com/owner/repo.git
 *   - github.com/owner/repo
 *   - owner/repo
 */
export function parseRepoUrl(
  url: string
): { owner: string; repo: string } | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const match = trimmed.match(
    /(?:(?:https?:\/\/)?github\.com\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/
  );
  if (!match) return null;

  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ""),
  };
}

/**
 * Read the GitHub repo URL and branch from site settings and return parsed config.
 * Throws if not configured or the URL is unparseable.
 */
export async function getRepoConfig(): Promise<{
  owner: string;
  repo: string;
  branch: string;
}> {
  const repoUrl = await getSetting(SETTING_KEYS.github_repo_url);
  if (!repoUrl) {
    throw new Error(
      "GitHub repository URL not configured. Please set it in Admin > Settings."
    );
  }

  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    throw new Error(
      `Unable to parse GitHub repository URL: "${repoUrl}". Expected format: owner/repo or https://github.com/owner/repo`
    );
  }

  const branch =
    (await getSetting(SETTING_KEYS.github_branch)) || "main";

  return { ...parsed, branch };
}
