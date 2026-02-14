import { getSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/settings/constants";

/**
 * Send an email via the SendGrid v3/mail/send REST API.
 *
 * Requires a SendGrid API key and verified sender email configured in settings.
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string
): Promise<void> {
  const [apiKey, fromEmail] = await Promise.all([
    getSetting(SETTING_KEYS.sendgrid_api_key),
    getSetting(SETTING_KEYS.sendgrid_from_email),
  ]);

  if (!apiKey) {
    throw new Error("SendGrid API key not configured");
  }
  if (!fromEmail) {
    throw new Error("SendGrid from email not configured");
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail },
      subject,
      content: [{ type: "text/html", value: htmlContent }],
    }),
  });

  if (!response.ok) {
    let errorMessage = `SendGrid error: ${response.status}`;
    try {
      const errorBody = await response.json();
      errorMessage += ` - ${JSON.stringify(errorBody.errors ?? errorBody)}`;
    } catch {
      // Could not parse error body
    }
    throw new Error(errorMessage);
  }
}
