"use client";

import { useActionState } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { updateNotificationPreferences } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface NotificationFormProps {
  user: {
    email: string | null;
    notifySlackEnabled: boolean;
    slackUserId: string | null;
    notifyEmailEnabled: boolean;
    notifyOnMention: boolean;
    notifyOnActivity: boolean;
  };
}

export function NotificationForm({ user }: NotificationFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateNotificationPreferences,
    null
  );

  const [slackEnabled, setSlackEnabled] = useState(user.notifySlackEnabled);

  useEffect(() => {
    if (state?.success) {
      toast.success("Notification preferences updated");
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Notification Channels
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifySlackEnabled">Slack DM notifications</Label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Receive notifications via Slack direct messages
              </p>
            </div>
            <Switch
              id="notifySlackEnabled"
              name="notifySlackEnabled"
              defaultChecked={user.notifySlackEnabled}
              onCheckedChange={setSlackEnabled}
            />
          </div>

          {slackEnabled && (
            <div className="ml-0 space-y-2 pl-0">
              <Label htmlFor="slackUserId">Slack User ID</Label>
              <Input
                id="slackUserId"
                name="slackUserId"
                type="text"
                defaultValue={user.slackUserId ?? ""}
                placeholder="U0XXXXXXXXX"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Find your Slack member ID in your Slack profile
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifyEmailEnabled">Email notifications</Label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Notifications sent to {user.email ?? "your email"}
              </p>
            </div>
            <Switch
              id="notifyEmailEnabled"
              name="notifyEmailEnabled"
              defaultChecked={user.notifyEmailEnabled}
            />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Notification Types
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifyOnMention">Mentions</Label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Notify when someone @mentions you in a comment
              </p>
            </div>
            <Switch
              id="notifyOnMention"
              name="notifyOnMention"
              defaultChecked={user.notifyOnMention}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifyOnActivity">Activity</Label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Notify when articles you edited are updated
              </p>
            </div>
            <Switch
              id="notifyOnActivity"
              name="notifyOnActivity"
              defaultChecked={user.notifyOnActivity}
            />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save Preferences"}
      </Button>
    </form>
  );
}
