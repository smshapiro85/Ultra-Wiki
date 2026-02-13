import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Welcome, {session?.user?.name ?? "User"}
      </h1>
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Role:</span>
        <Badge
          variant={
            session?.user?.role === "admin" ? "destructive" : "secondary"
          }
        >
          {session?.user?.role ?? "user"}
        </Badge>
      </div>
      <p className="text-zinc-500 dark:text-zinc-400">
        This is a placeholder home page. The real dashboard will be built in
        Phase 4.
      </p>
    </div>
  );
}
