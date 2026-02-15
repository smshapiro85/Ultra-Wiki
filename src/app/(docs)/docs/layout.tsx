import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/wiki/app-sidebar";
import { AdminSettingsDropdown } from "@/components/admin/admin-settings-dropdown";
import { UserMenu } from "@/components/common/user-menu";
import { TocProvider } from "@/components/wiki/toc-context";
import { getCategoryTreeWithArticles } from "@/lib/wiki/queries";

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const db = getDb();
  const [user] = await db
    .select({
      name: users.name,
      email: users.email,
      image: users.image,
      avatarUrl: users.avatarUrl,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    redirect("/login");
  }

  const categoryTree = await getCategoryTreeWithArticles();

  return (
    <TocProvider>
      <SidebarProvider>
        <AppSidebar categories={categoryTree} isAdmin={user.role === "admin"} />
        <SidebarInset>
          <header className="flex h-14 items-center gap-2 border-b px-4">
            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/docs"
                className="flex items-center justify-center rounded-md p-2 text-foreground bg-accent"
                title="Help & Docs"
              >
                <CircleHelp className="size-5" />
              </Link>
              {user.role === "admin" && <AdminSettingsDropdown />}
              <UserMenu user={user} />
            </div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TocProvider>
  );
}
