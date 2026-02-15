"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { CategoryTree } from "@/components/wiki/category-tree";
import { SidebarToc } from "@/components/wiki/sidebar-toc";
import type { CategoryWithArticles } from "@/lib/wiki/queries";

interface AppSidebarProps {
  categories: CategoryWithArticles[];
}

export function AppSidebar({ categories }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/"
          className="flex items-center gap-2 px-2 py-1.5 text-sm font-bold"
        >
          <BookOpen className="size-5 shrink-0" />
          <span className="truncate group-data-[collapsible=icon]:hidden">
            UltraWiki
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <CategoryTree categories={categories} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarToc />
      </SidebarContent>

      <SidebarFooter>
        <SidebarTrigger className="w-full justify-start" />
      </SidebarFooter>
    </Sidebar>
  );
}
