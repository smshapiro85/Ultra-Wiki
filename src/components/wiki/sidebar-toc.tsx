"use client";

import { List, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { useToc } from "./toc-context";

/**
 * Collapsible "On this page" section in the left sidebar.
 * Only renders when TOC entries exist (i.e. on article pages).
 * Collapsed by default.
 */
export function SidebarToc() {
  const { entries } = useToc();

  if (entries.length === 0) return null;

  return (
    <SidebarGroup>
      <Collapsible className="group/toc">
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="flex w-full items-center gap-2">
            <List className="size-4 shrink-0" />
            On this page
            <ChevronRight className="ml-auto size-4 shrink-0 transition-transform group-data-[state=open]/toc:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {entries.map((entry) => {
                if (entry.level === 1) {
                  return (
                    <SidebarMenuItem key={entry.id}>
                      <SidebarMenuButton asChild className="font-medium">
                        <a href={`#${entry.id}`}>
                          <span className="truncate">{entry.text}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={entry.id}>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild>
                          <a href={`#${entry.id}`}>
                            <span className="truncate">{entry.text}</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
}
