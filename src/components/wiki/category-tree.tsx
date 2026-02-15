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
import {
  CategoryContextMenu,
  SubcategoryContextMenu,
  ArticleContextMenu,
} from "@/components/wiki/sidebar-context-menu";
import type { CategoryWithArticles } from "@/lib/wiki/queries";

interface CategoryNodeProps {
  category: CategoryWithArticles;
  isAdmin: boolean;
  allCategories: CategoryWithArticles[];
  isSubcategory?: boolean;
}

function CategoryNode({
  category,
  isAdmin,
  allCategories,
  isSubcategory = false,
}: CategoryNodeProps) {
  const pathname = usePathname();

  return (
    <SidebarMenuItem>
      <Collapsible defaultOpen className="group/collapsible">
        <div className="group/item flex items-center">
          <CollapsibleTrigger asChild>
            <SidebarMenuButton className="font-medium flex-1">
              <FolderOpen className="size-4 shrink-0" />
              <span className="truncate">{category.name}</span>
              <ChevronRight className="ml-auto size-4 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          {isSubcategory ? (
            <SubcategoryContextMenu
              subcategory={category}
              isAdmin={isAdmin}
            />
          ) : (
            <CategoryContextMenu category={category} isAdmin={isAdmin} />
          )}
        </div>
        <CollapsibleContent>
          <SidebarMenuSub>
            {category.articles.map((article) => {
              const isActive = pathname === `/wiki/${article.slug}`;
              return (
                <SidebarMenuSubItem key={article.id}>
                  <div className="group/item flex items-center">
                    <SidebarMenuSubButton
                      asChild
                      isActive={isActive}
                      className="flex-1"
                    >
                      <Link href={`/wiki/${article.slug}`}>
                        <FileText className="size-4 shrink-0" />
                        <span className="truncate">{article.title}</span>
                      </Link>
                    </SidebarMenuSubButton>
                    <ArticleContextMenu
                      article={article}
                      categories={allCategories}
                      isAdmin={isAdmin}
                    />
                  </div>
                </SidebarMenuSubItem>
              );
            })}
            {category.children.map((child) => (
              <CategoryNode
                key={child.id}
                category={child}
                isAdmin={isAdmin}
                allCategories={allCategories}
                isSubcategory
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

interface CategoryTreeProps {
  categories: CategoryWithArticles[];
  isAdmin: boolean;
}

export function CategoryTree({ categories, isAdmin }: CategoryTreeProps) {
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
        <CategoryNode
          key={category.id}
          category={category}
          isAdmin={isAdmin}
          allCategories={categories}
        />
      ))}
    </SidebarMenu>
  );
}
