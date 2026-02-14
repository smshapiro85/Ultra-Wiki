import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchUsers } from "@/lib/wiki/queries";

/**
 * GET /api/users/search?q=query
 *
 * Search users by name or email for @mention autocomplete.
 * Returns array of { id, display } matching react-mentions-ts format.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.trim().length === 0) {
    return NextResponse.json([]);
  }

  const users = await searchUsers(q.trim());

  // Map to react-mentions-ts format: { id, display }
  const results = users.map((u) => ({
    id: u.id,
    display: u.name || u.email || "Unknown",
  }));

  return NextResponse.json(results);
}
