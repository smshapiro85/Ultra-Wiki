import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const db = getDb();
  const [user] = await db
    .select({ name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Welcome, {user?.name ?? "User"}
      </h1>
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Role:</span>
        <Badge
          variant={
            user?.role === "admin" ? "destructive" : "secondary"
          }
        >
          {user?.role ?? "user"}
        </Badge>
      </div>
      <p className="text-zinc-500 dark:text-zinc-400">
        This is a placeholder home page. The real dashboard will be built in
        Phase 4.
      </p>
    </div>
  );
}
