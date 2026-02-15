"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { saveApiKeys } from "./actions";
import { MASK_VALUE } from "@/lib/settings/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface ApiKeysSettingsProps {
  settings: Record<string, { value: string; isSecret: boolean }>;
}

function TestConnectionButton({
  type,
  inputRef,
}: {
  type: "github" | "openrouter";
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  async function handleTest() {
    const apiKey = inputRef.current?.value;
    if (!apiKey || apiKey === MASK_VALUE) {
      setResult({ success: false, error: "Enter an API key first" });
      return;
    }

    setTesting(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/settings/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, apiKey }),
      });
      const data = await response.json();
      setResult(data);
    } catch {
      setResult({ success: false, error: "Request failed" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleTest}
        disabled={testing}
      >
        {testing ? "Testing..." : "Test Connection"}
      </Button>
      {result && (
        <span
          className={`text-xs ${
            result.success ? "text-green-600" : "text-red-500"
          }`}
        >
          {result.success
            ? result.message ?? "Connected"
            : result.error ?? "Failed"}
        </span>
      )}
    </div>
  );
}

function TestNotificationButton({
  type,
  getPayload,
}: {
  type: "slack" | "sendgrid";
  getPayload: () =>
    | { type: string; value: string; fromEmail?: string; testEmail?: string }
    | null;
}) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  async function handleTest() {
    const payload = getPayload();
    if (!payload) {
      setResult({ success: false, error: "Fill in the required fields first" });
      return;
    }

    setTesting(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/settings/test-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      setResult(data);
    } catch {
      setResult({ success: false, error: "Request failed" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleTest}
        disabled={testing}
      >
        {testing
          ? "Testing..."
          : type === "slack"
            ? "Test Slack Bot"
            : "Send Test Email"}
      </Button>
      {result && (
        <span
          className={`text-xs ${
            result.success ? "text-green-600" : "text-red-500"
          }`}
        >
          {result.success
            ? result.message ?? "Success"
            : result.error ?? "Failed"}
        </span>
      )}
    </div>
  );
}

export function ApiKeysSettings({ settings }: ApiKeysSettingsProps) {
  const [state, formAction, isPending] = useActionState(saveApiKeys, null);
  const githubKeyRef = useRef<HTMLInputElement>(null);
  const openrouterKeyRef = useRef<HTMLInputElement>(null);
  const slackTokenRef = useRef<HTMLInputElement>(null);
  const sendgridKeyRef = useRef<HTMLInputElement>(null);
  const sendgridFromRef = useRef<HTMLInputElement>(null);
  const [testRecipientEmail, setTestRecipientEmail] = useState("");

  useEffect(() => {
    if (state?.success) {
      toast.success("API keys saved");
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  function secretPlaceholder(key: string) {
    const setting = settings[key];
    if (!setting) return "Not configured";
    if (setting.isSecret && setting.value === MASK_VALUE)
      return "Enter new value to update";
    if (setting.value === "") return "Not configured";
    return "";
  }

  function secretDefaultValue(key: string) {
    const setting = settings[key];
    if (!setting) return "";
    // For secret fields with a stored value, show the mask as default
    if (setting.isSecret && setting.value === MASK_VALUE) return MASK_VALUE;
    return setting.value;
  }

  return (
    <form action={formAction} className="space-y-6">
      {/* GitHub */}
      <Card>
        <CardHeader>
          <CardTitle>GitHub</CardTitle>
          <CardDescription>
            Personal Access Token for repository access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="github_api_key">API Key</Label>
            <Input
              ref={githubKeyRef}
              id="github_api_key"
              name="github_api_key"
              type="password"
              defaultValue={secretDefaultValue("github_api_key")}
              placeholder={secretPlaceholder("github_api_key")}
            />
            <TestConnectionButton type="github" inputRef={githubKeyRef} />
          </div>
        </CardContent>
      </Card>

      {/* OpenRouter */}
      <Card>
        <CardHeader>
          <CardTitle>OpenRouter</CardTitle>
          <CardDescription>
            AI model provider. Model selection is configured per-prompt in the AI Prompts tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openrouter_api_key">API Key</Label>
            <Input
              ref={openrouterKeyRef}
              id="openrouter_api_key"
              name="openrouter_api_key"
              type="password"
              defaultValue={secretDefaultValue("openrouter_api_key")}
              placeholder={secretPlaceholder("openrouter_api_key")}
            />
            <TestConnectionButton
              type="openrouter"
              inputRef={openrouterKeyRef}
            />
          </div>
        </CardContent>
      </Card>

      {/* SendGrid */}
      <Card>
        <CardHeader>
          <CardTitle>SendGrid</CardTitle>
          <CardDescription>Email delivery for notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sendgrid_api_key">API Key</Label>
            <Input
              ref={sendgridKeyRef}
              id="sendgrid_api_key"
              name="sendgrid_api_key"
              type="password"
              defaultValue={secretDefaultValue("sendgrid_api_key")}
              placeholder={secretPlaceholder("sendgrid_api_key")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sendgrid_from_email">From Email</Label>
            <Input
              ref={sendgridFromRef}
              id="sendgrid_from_email"
              name="sendgrid_from_email"
              type="email"
              defaultValue={settings.sendgrid_from_email?.value ?? ""}
              placeholder="noreply@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sendgrid_test_email">Test Email Recipient</Label>
            <Input
              id="sendgrid_test_email"
              type="email"
              value={testRecipientEmail}
              onChange={(e) => setTestRecipientEmail(e.target.value)}
              placeholder="your-email@example.com"
            />
          </div>
          <TestNotificationButton
            type="sendgrid"
            getPayload={() => {
              const value = sendgridKeyRef.current?.value;
              const fromEmail = sendgridFromRef.current?.value;
              if (!value || value === MASK_VALUE || !fromEmail || !testRecipientEmail) return null;
              return { type: "sendgrid", value, fromEmail, testEmail: testRecipientEmail };
            }}
          />
          <p className="text-xs text-muted-foreground">
            Sender email must be verified in SendGrid.
          </p>
        </CardContent>
      </Card>

      {/* Slack */}
      <Card>
        <CardHeader>
          <CardTitle>Slack</CardTitle>
          <CardDescription>Bot token for Slack notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slack_bot_token">Bot Token</Label>
            <Input
              ref={slackTokenRef}
              id="slack_bot_token"
              name="slack_bot_token"
              type="password"
              defaultValue={secretDefaultValue("slack_bot_token")}
              placeholder={secretPlaceholder("slack_bot_token")}
            />
            <TestNotificationButton
              type="slack"
              getPayload={() => {
                const value = slackTokenRef.current?.value;
                if (!value || value === MASK_VALUE) return null;
                return { type: "slack", value };
              }}
            />
            <p className="text-xs text-muted-foreground">
              Required Slack bot scope: <code>chat:write</code>. The bot token
              starts with <code>xoxb-</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save API Keys"}
      </Button>
    </form>
  );
}
