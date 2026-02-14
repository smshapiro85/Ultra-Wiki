import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOctokit, getRepoConfig } from "@/lib/github/client";
import { withRetry } from "@/lib/github/retry";
import { inferLanguage } from "@/lib/github/language";
import { codeToHtml } from "shiki";

const MAX_FILE_SIZE = 500 * 1024; // 500KB

/**
 * GET /api/github/file-content?path=src/lib/foo.ts
 *
 * Fetches a file from the configured GitHub repository, highlights it
 * with shiki, and returns the HTML along with raw content and language.
 *
 * Returns:
 * - 200 { html, content, lang, path } on success
 * - 200 { tooLarge: true, path } if file exceeds 500KB (client handles gracefully)
 * - 400 if path param missing or response is a directory
 * - 401 if not authenticated
 * - 500 on errors
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get("path");

  if (!filePath) {
    return NextResponse.json(
      { error: "Missing required 'path' query parameter" },
      { status: 400 }
    );
  }

  try {
    const octokit = await getOctokit();
    const { owner, repo, branch } = await getRepoConfig();

    const { data } = await withRetry(() =>
      octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: branch,
      })
    );

    // Validate response is a file (not array/directory)
    if (Array.isArray(data) || data.type !== "file") {
      return NextResponse.json(
        { error: "Path is a directory, not a file" },
        { status: 400 }
      );
    }

    // Decode base64 content
    const content = Buffer.from(data.content, "base64").toString("utf-8");

    // Check file size limit
    if (content.length > MAX_FILE_SIZE) {
      return NextResponse.json({ tooLarge: true, path: filePath });
    }

    // Determine language and highlight
    const lang = inferLanguage(filePath);
    const html = await codeToHtml(content, {
      lang,
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    });

    return NextResponse.json({ html, content, lang, path: filePath });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch file content";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
