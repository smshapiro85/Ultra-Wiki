"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
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
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
        <div className="flex items-center">
          <Link
            href="/"
            className="flex flex-1 items-center gap-2.5 px-2 font-bold min-w-0 group-data-[collapsible=icon]:hidden"
          >
            <BookOpen className="size-6 shrink-0" />
            <span className="truncate text-base">UltraWiki</span>
          </Link>
          <SidebarTrigger />
        </div>
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

    </Sidebar>
  );
}
