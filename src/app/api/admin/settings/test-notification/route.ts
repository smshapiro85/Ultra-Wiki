import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * POST /api/admin/settings/test-notification
 *
 * Test Slack bot token or SendGrid API key configuration.
 * Admin-only endpoint.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: {
    type: "slack" | "sendgrid";
    value: string;
    fromEmail?: string;
    testEmail?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { type, value } = body;

  if (!type || !value) {
    return NextResponse.json(
      { success: false, error: "Missing type or value" },
      { status: 400 }
    );
  }

  // --- Slack: validate bot token via auth.test ---
  if (type === "slack") {
    try {
      const response = await fetch("https://slack.com/api/auth.test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${value}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      if (data.ok) {
        return NextResponse.json({
          success: true,
          message: `Slack bot authenticated as ${data.bot_id || data.user || "bot"}`,
        });
      }
      return NextResponse.json({
        success: false,
        error: `Slack auth failed: ${data.error}`,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Slack connection failed";
      return NextResponse.json({ success: false, error: message });
    }
  }

  // --- SendGrid: send test email ---
  if (type === "sendgrid") {
    const { fromEmail, testEmail } = body;
    if (!fromEmail || !testEmail) {
      return NextResponse.json(
        { success: false, error: "Missing fromEmail or testEmail for SendGrid test" },
        { status: 400 }
      );
    }

    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${value}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: testEmail }] }],
          from: { email: fromEmail },
          subject: "CodeWiki Test Notification",
          content: [
            {
              type: "text/html",
              value:
                "<p>This is a test notification from CodeWiki. If you received this, SendGrid is configured correctly.</p>",
            },
          ],
        }),
      });

      if (response.ok || response.status === 202) {
        return NextResponse.json({
          success: true,
          message: `Test email sent to ${testEmail}`,
        });
      }

      let errorDetail = `SendGrid returned ${response.status}`;
      try {
        const errorBody = await response.json();
        errorDetail += `: ${JSON.stringify(errorBody.errors ?? errorBody)}`;
      } catch {
        // Could not parse error body
      }
      return NextResponse.json({ success: false, error: errorDetail });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "SendGrid connection failed";
      return NextResponse.json({ success: false, error: message });
    }
  }

  return NextResponse.json(
    { success: false, error: `Unknown notification type: ${type}` },
    { status: 400 }
  );
}
