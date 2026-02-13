import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { type: string; apiKey: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { type, apiKey } = body;

  if (!type || !apiKey) {
    return NextResponse.json(
      { success: false, error: "Missing type or apiKey" },
      { status: 400 }
    );
  }

  if (type === "github") {
    try {
      const octokit = new Octokit({ auth: apiKey });
      const { data } = await octokit.rest.users.getAuthenticated();
      return NextResponse.json({
        success: true,
        message: `Authenticated as ${data.login}`,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "GitHub authentication failed";
      return NextResponse.json({ success: false, error: message });
    }
  }

  if (type === "openrouter") {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/key", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        return NextResponse.json({
          success: false,
          error: `OpenRouter returned ${response.status}`,
        });
      }
      return NextResponse.json({
        success: true,
        message: "OpenRouter connection successful",
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "OpenRouter connection failed";
      return NextResponse.json({ success: false, error: message });
    }
  }

  return NextResponse.json(
    { success: false, error: `Unknown connection type: ${type}` },
    { status: 400 }
  );
}
