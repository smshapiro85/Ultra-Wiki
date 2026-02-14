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
} from "@/components/ui/sidebar";
import { CategoryTree } from "@/components/wiki/category-tree";
import { UserMenu } from "@/components/common/user-menu";
import type { CategoryWithArticles } from "@/lib/wiki/queries";

interface AppSidebarProps {
  categories: CategoryWithArticles[];
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
    avatarUrl: string | null;
    role: string;
  };
}

export function AppSidebar({ categories, user }: AppSidebarProps) {
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
      </SidebarContent>

      <SidebarFooter>
        <div className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
          <UserMenu user={user} />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
