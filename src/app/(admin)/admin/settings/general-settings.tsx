"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import cronstrue from "cronstrue";
import { saveGeneralSettings } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface GeneralSettingsProps {
  settings: Record<string, { value: string; isSecret: boolean }>;
}

export function GeneralSettings({ settings }: GeneralSettingsProps) {
  const [state, formAction, isPending] = useActionState(
    saveGeneralSettings,
    null
  );
  const [cronInput, setCronInput] = useState(
    settings.sync_cron_schedule?.value ?? ""
  );

  useEffect(() => {
    if (state?.success) {
      toast.success("General settings saved");
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  let cronPreview = "";
  if (cronInput.trim()) {
    try {
      cronPreview = cronstrue.toString(cronInput);
    } catch {
      cronPreview = "Invalid cron expression";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="github_repo_url">GitHub Repository URL</Label>
            <Input
              id="github_repo_url"
              name="github_repo_url"
              type="url"
              defaultValue={settings.github_repo_url?.value ?? ""}
              placeholder="https://github.com/owner/repo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="github_branch">Branch</Label>
            <Input
              id="github_branch"
              name="github_branch"
              type="text"
              defaultValue={settings.github_branch?.value || "main"}
              placeholder="main"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sync_cron_schedule">Sync Schedule (Cron)</Label>
            <Input
              id="sync_cron_schedule"
              name="sync_cron_schedule"
              type="text"
              value={cronInput}
              onChange={(e) => setCronInput(e.target.value)}
              placeholder="0 9 * * 6"
            />
            {cronInput.trim() && (
              <p
                className={`text-xs ${
                  cronPreview === "Invalid cron expression"
                    ? "text-red-500"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {cronPreview}
              </p>
            )}
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save General Settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
