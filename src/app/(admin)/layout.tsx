import Link from "next/link";
import { cookies } from "next/headers";
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
import { AdminNav } from "@/components/admin/admin-nav";
import { TocProvider } from "@/components/wiki/toc-context";
import { getCategoryTreeWithArticles } from "@/lib/wiki/queries";

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
  const cookieStore = await cookies();
  const sidebarWidth = Number(cookieStore.get("sidebar_width")?.value) || undefined;

  return (
    <TocProvider>
      <SidebarProvider defaultWidth={sidebarWidth}>
        <AppSidebar categories={categoryTree} isAdmin={user.role === "admin"} />
        <SidebarInset>
          <header className="flex h-14 items-center gap-2 border-b px-4">
            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/docs"
                className="flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Help & Docs"
              >
                <CircleHelp className="size-5" />
              </Link>
              <AdminSettingsDropdown />
              <UserMenu user={user} />
            </div>
          </header>
          <div className="border-b px-6 pt-6 pb-0">
            <h1 className="mb-4 text-2xl font-bold tracking-tight">Admin Configuration</h1>
            <AdminNav />
          </div>
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TocProvider>
  );
}
