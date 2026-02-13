/**
 * Shared retry utility for GitHub API operations.
 * Extracted from sync.ts to enable reuse in the AI pipeline's file content fetching.
 */

const RETRY_DELAYS = [1000, 4000, 16000];

export function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Rate limit or network errors are transient
    if (msg.includes("rate limit") || msg.includes("rate_limit")) return true;
    if (msg.includes("network") || msg.includes("econnreset")) return true;
    if (msg.includes("etimedout") || msg.includes("enotfound")) return true;
    if (msg.includes("socket hang up")) return true;
    if (msg.includes("503") || msg.includes("502")) return true;
  }
  // Check for Octokit error status
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error
  ) {
    const status = (error as { status: number }).status;
    // 401 (auth) and 404 (not found) are NOT transient
    if (status === 401 || status === 404 || status === 403) return false;
    // 5xx and 429 (rate limit) are transient
    if (status >= 500 || status === 429) return true;
  }
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number[] = RETRY_DELAYS
): Promise<T> {
  let lastError: unknown;
  // First attempt (no delay)
  try {
    return await fn();
  } catch (error) {
    lastError = error;
    if (!isTransientError(error) || retries.length === 0) throw error;
  }

  // Retry attempts with delays
  for (let i = 0; i < retries.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, retries[i]));
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientError(error)) throw error;
    }
  }

  throw lastError;
}
