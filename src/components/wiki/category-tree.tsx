"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, FileText, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import type { CategoryWithArticles } from "@/lib/wiki/queries";

function CategoryNode({ category }: { category: CategoryWithArticles }) {
  const pathname = usePathname();

  return (
    <SidebarMenuItem>
      <Collapsible defaultOpen className="group/collapsible">
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className="font-medium">
            <FolderOpen className="size-4 shrink-0" />
            <span className="truncate">{category.name}</span>
            <ChevronRight className="ml-auto size-4 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {category.articles.map((article) => {
              const isActive = pathname === `/wiki/${article.slug}`;
              return (
                <SidebarMenuSubItem key={article.id}>
                  <SidebarMenuSubButton asChild isActive={isActive}>
                    <Link href={`/wiki/${article.slug}`}>
                      <FileText className="size-4 shrink-0" />
                      <span className="truncate">{article.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
            {category.children.map((child) => (
              <CategoryNode key={child.id} category={child} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

export function CategoryTree({
  categories,
}: {
  categories: CategoryWithArticles[];
}) {
  if (categories.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-muted-foreground">
        No categories yet. Run a sync to populate the wiki.
      </div>
    );
  }

  return (
    <SidebarMenu>
      {categories.map((category) => (
        <CategoryNode key={category.id} category={category} />
      ))}
    </SidebarMenu>
  );
}
