import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/");
  }

  const initials = session.user.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "U";

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <nav className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-lg font-bold text-zinc-900 dark:text-zinc-100"
            >
              UltraWiki
            </Link>
            <div className="flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              Admin
            </div>
            <Link
              href="/admin/settings"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Settings
            </Link>
            <Link
              href="/admin/sync"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Sync
            </Link>
            <Link
              href="/admin/users"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Users
            </Link>
            <Link
              href="/admin/review-queue"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Review Queue
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={session.user.image ?? undefined}
                  alt={session.user.name ?? "User"}
                />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm text-zinc-700 dark:text-zinc-300 sm:inline">
                {session.user.name}
              </span>
            </div>

            <Link href="/">
              <Button variant="ghost" size="sm">
                Back to Wiki
              </Button>
            </Link>

            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button type="submit" variant="ghost" size="sm">
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
