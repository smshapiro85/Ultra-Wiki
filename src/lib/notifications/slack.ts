import { getSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/settings/constants";

/**
 * Send a Slack DM to a user via the Slack chat.postMessage REST API.
 *
 * Requires a Slack Bot Token with `chat:write` scope configured in settings.
 * The `channel` parameter for DMs is the user's Slack User ID (e.g. U12345).
 */
export async function sendSlackDM(
  slackUserId: string,
  text: string
): Promise<void> {
  const token = await getSetting(SETTING_KEYS.slack_bot_token);
  if (!token) {
    throw new Error("Slack bot token not configured");
  }

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel: slackUserId, text }),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error("Slack API error: " + data.error);
  }
}
