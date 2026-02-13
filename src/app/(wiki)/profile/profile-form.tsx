"use client";

import { useActionState } from "react";
import { useEffect } from "react";
import { toast } from "sonner";
import { updateProfile } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ProfileFormProps {
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
    avatarUrl: string | null;
  };
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(updateProfile, null);

  useEffect(() => {
    if (state?.success) {
      toast.success("Profile updated successfully");
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "U";

  return (
    <form action={formAction} className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage
            src={user.image ?? undefined}
            alt={user.name ?? "User"}
          />
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Google avatar
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {user.email}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Display Name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          maxLength={100}
          defaultValue={user.name ?? ""}
          placeholder="Your display name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="avatarUrl">Custom Avatar URL</Label>
        <Input
          id="avatarUrl"
          name="avatarUrl"
          type="url"
          defaultValue={user.avatarUrl ?? ""}
          placeholder="https://example.com/avatar.jpg"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Leave empty to use your Google profile picture
        </p>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save Profile"}
      </Button>
    </form>
  );
}
