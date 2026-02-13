"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { promoteUser, demoteUser } from "./actions";

interface UserActionsProps {
  userId: string;
  userRole: string;
  isCurrentUser: boolean;
}

export function UserActions({
  userId,
  userRole,
  isCurrentUser,
}: UserActionsProps) {
  const [isPending, startTransition] = useTransition();

  if (userRole === "admin" && isCurrentUser) {
    // Cannot demote yourself
    return (
      <span className="text-xs text-zinc-400 dark:text-zinc-500">--</span>
    );
  }

  if (userRole === "admin") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => startTransition(() => demoteUser(userId))}
      >
        {isPending ? "Demoting..." : "Demote"}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(() => promoteUser(userId))}
    >
      {isPending ? "Promoting..." : "Promote"}
    </Button>
  );
}
