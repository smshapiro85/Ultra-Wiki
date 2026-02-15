"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, RefreshCw, Users, ClipboardList, KeyRound, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const adminTabs = [
  { href: "/admin/settings", label: "General", icon: Settings },
  { href: "/admin/api-keys", label: "API Keys", icon: KeyRound },
  { href: "/admin/ai-prompts", label: "AI Prompts", icon: Sparkles },
  { href: "/admin/sync", label: "Sync", icon: RefreshCw },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/review-queue", label: "Review Queue", icon: ClipboardList },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1">
        {adminTabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 border-b-2 -mb-px px-4 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </Link>
          );
        })}
    </nav>
  );
}
