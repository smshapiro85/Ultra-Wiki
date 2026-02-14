import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AppSidebar } from "@/components/wiki/app-sidebar";
import { SearchInput } from "@/components/wiki/search-input";
import { TocProvider } from "@/components/wiki/toc-context";
import { getCategoryTreeWithArticles } from "@/lib/wiki/queries";

export default async function WikiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
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
        <AppSidebar categories={categoryTree} user={user} />
        <SidebarInset>
          <header className="flex h-14 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <div className="flex flex-1 items-center gap-2">
              <Separator orientation="vertical" className="h-4" />
              <div className="ml-auto w-64">
                <Suspense fallback={<Skeleton className="h-9 w-full" />}>
                  <SearchInput />
                </Suspense>
              </div>
            </div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TocProvider>
  );
}
