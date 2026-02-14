# Phase 7: Ask AI & Notifications - Research

**Researched:** 2026-02-14
**Domain:** AI chat UI (streaming), notification delivery (Slack DM, SendGrid email)
**Confidence:** HIGH

## Summary

Phase 7 has two distinct sub-domains: (1) an Ask AI chat feature with global and page-level scopes, streaming markdown responses, and conversation persistence, and (2) a notification service delivering Slack DMs and emails based on user preferences when specific events occur (mentions, comments, AI sync updates, conflict flags).

The project is well-positioned for this phase. The Vercel AI SDK v6 (already installed as `ai@^6.0.86`) provides `useChat` + `streamText` with built-in SSE streaming, conversation management, and custom body parameter support. The schema already contains `ai_conversations` and `ai_conversation_messages` tables, notification preference columns on `users`, and the `mentions` table. Setting keys for `slack_bot_token`, `sendgrid_api_key`, `sendgrid_from_email`, `ask_ai_global_prompt`, and `ask_ai_page_prompt` are already seeded. The admin settings UI already has fields for configuring these keys but lacks test buttons for Slack/SendGrid.

**Primary recommendation:** Use `useChat` with `DefaultChatTransport` and `prepareSendMessagesRequest` for the chat UI, `streamText` with `system` prompt and `convertToModelMessages` on the API route, persist to the existing `ai_conversations`/`ai_conversation_messages` tables. For notifications, use raw `fetch()` against Slack and SendGrid REST APIs (no new npm dependencies needed) with a fire-and-forget pattern from the places where notification events originate (comment creation, pipeline completion).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` (Vercel AI SDK) | ^6.0.86 | `streamText`, `convertToModelMessages`, `UIMessage` | Already installed; provides streaming, message protocol, SSE |
| `@ai-sdk/react` | (peer of ai) | `useChat`, `DefaultChatTransport` | Already installed; manages chat state, streaming UI |
| `@openrouter/ai-sdk-provider` | ^2.2.3 | AI model provider via OpenRouter | Already installed; `getAIModel()` in `src/lib/ai/client.ts` |
| `react-markdown` | ^10.1.0 | Render markdown in chat responses | Already installed; used for article content rendering |
| `marked` | (new) | Lexer for splitting markdown into blocks for memoization | Needed for streaming markdown memoization pattern |
| `drizzle-orm` | ^0.45.1 | Database queries for conversations, preferences | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sonner` | ^2.0.7 | Toast notifications for errors/success | Already installed; used throughout app |
| `lucide-react` | ^0.564.0 | Icons (Sparkles, MessageSquare, Bell, Send) | Already installed |
| `radix-ui` Sheet | ^1.4.3 | Slide-out panel for Ask AI chat | Already installed as `@/components/ui/sheet.tsx` |

### No New Dependencies Needed for Notifications
| Service | Approach | Why No SDK |
|---------|----------|------------|
| Slack DM | `fetch("https://slack.com/api/chat.postMessage")` with bot token | Single REST call; SDK adds 500KB+ for one method |
| SendGrid Email | `fetch("https://api.sendgrid.com/v3/mail/send")` with API key | Single REST call; `@sendgrid/mail` unnecessary for one endpoint |
| Slack token test | `fetch("https://slack.com/api/auth.test")` with bot token | Returns bot identity; validates token is valid |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-markdown` for streaming | `streamdown` (Vercel) | Purpose-built for streaming, but adds dependency; `marked` lexer + `react-markdown` memoization achieves same result with existing dep |
| Raw `fetch` for Slack | `@slack/web-api` | Full SDK for one API call is excessive; raw fetch is ~10 lines |
| Raw `fetch` for SendGrid | `@sendgrid/mail` | Same reasoning; one simple POST endpoint |
| Sheet panel for chat | Full-page chat route | Sheet keeps user in context; matches UX of "ask from any page" |

**Installation:**
```bash
npm install marked
npm install --save-dev @types/marked
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    api/
      chat/
        route.ts                 # Global Ask AI streaming endpoint
      chat/article/
        route.ts                 # Page-level Ask AI streaming endpoint
      conversations/
        route.ts                 # GET list, POST create, DELETE conversation
        [id]/
          route.ts               # GET single conversation with messages
      admin/settings/
        test-notification/
          route.ts               # POST test Slack/SendGrid notification
  components/
    chat/
      ask-ai-panel.tsx           # Sheet-based chat UI (shared by global + page)
      ask-ai-global-trigger.tsx  # Header button that opens global panel
      ask-ai-page-trigger.tsx    # Article page button that opens page panel
      chat-message.tsx           # Single message with memoized markdown
      memoized-markdown.tsx      # Streaming-safe markdown renderer
      context-indicator.tsx      # Shows what context was used
      conversation-list.tsx      # Previous conversations sidebar/dropdown
  lib/
    notifications/
      service.ts                 # sendNotification(type, payload) dispatcher
      slack.ts                   # sendSlackDM(userId, message)
      email.ts                   # sendEmail(to, subject, html)
      templates.ts               # Notification message templates
```

### Pattern 1: Streaming Chat with Conversation Persistence
**What:** Use `useChat` with `DefaultChatTransport` and `prepareSendMessagesRequest` to send only the latest message + conversation ID. Server loads prior messages from DB, runs `streamText`, and persists both user message and assistant response on stream completion.
**When to use:** Both global and page-level Ask AI endpoints.
**Example:**
```typescript
// Client: ask-ai-panel.tsx
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const { messages, sendMessage, status } = useChat({
  id: conversationId,
  messages: initialMessages,
  transport: new DefaultChatTransport({
    api: endpoint, // '/api/chat' or '/api/chat/article'
    prepareSendMessagesRequest: ({ id, messages }) => ({
      body: {
        conversationId: id,
        message: messages[messages.length - 1],
        // Page-level: include articleId
        ...(articleId ? { articleId } : {}),
      },
    }),
  }),
  experimental_throttle: 50,
});

// Server: app/api/chat/route.ts
import { streamText, convertToModelMessages, UIMessage } from 'ai';
import { getAIModel } from '@/lib/ai/client';

export async function POST(req: Request) {
  const { conversationId, message } = await req.json();

  // Load prior messages from DB
  const priorMessages = await loadConversationMessages(conversationId);
  priorMessages.push(message);

  // Load system prompt from settings
  const systemPrompt = await getSetting(SETTING_KEYS.ask_ai_global_prompt);

  // Build context (article index for global)
  const articleIndex = await getArticleIndex();
  const contextText = buildGlobalContext(articleIndex);

  const model = await getAIModel();
  const result = streamText({
    model,
    system: `${systemPrompt || DEFAULT_GLOBAL_PROMPT}\n\n${contextText}`,
    messages: await convertToModelMessages(priorMessages),
  });

  // Persist on finish, but don't block stream
  result.consumeStream();

  return result.toUIMessageStreamResponse({
    onFinish: async ({ messages: allMessages }) => {
      await saveConversationMessages(conversationId, allMessages);
    },
  });
}
```

### Pattern 2: Fire-and-Forget Notifications
**What:** Notification dispatch is non-blocking. When an event occurs (comment, mention, AI update), the calling code fires the notification and does not await completion. Failures are logged but never break the primary action.
**When to use:** All notification triggers.
**Example:**
```typescript
// lib/notifications/service.ts
export async function notifyMention(
  mentionedUserId: string,
  mentionerName: string,
  articleTitle: string,
  articleSlug: string,
  commentPreview: string
): Promise<void> {
  try {
    const user = await getUserNotificationPrefs(mentionedUserId);
    if (!user.notifyOnMention) return;

    const message = templates.mention({
      mentionerName, articleTitle, articleSlug, commentPreview
    });

    const promises: Promise<void>[] = [];
    if (user.notifySlackEnabled && user.slackUserId) {
      promises.push(sendSlackDM(user.slackUserId, message.slack));
    }
    if (user.notifyEmailEnabled && user.email) {
      promises.push(sendEmail(user.email, message.subject, message.html));
    }

    await Promise.allSettled(promises);
  } catch (error) {
    console.error('[notifications] Failed to notify mention:', error);
  }
}

// Called from comment creation API route (non-blocking)
// In POST /api/articles/[id]/comments route.ts:
if (mentionedUserIds.size > 0) {
  for (const userId of mentionedUserIds) {
    notifyMention(userId, session.user.name, article.title, article.slug, body.contentMarkdown.slice(0, 200))
      .catch(err => console.error('[notify] mention failed:', err));
  }
}
```

### Pattern 3: Page-Level Context Assembly
**What:** For page-level Ask AI, assemble rich context from the article, its technical view, linked files (with AI summaries), and DB tables. Pass as system prompt context.
**When to use:** Page-level Ask AI endpoint only.
**Example:**
```typescript
// In /api/chat/article/route.ts
async function buildArticleContext(articleId: string): Promise<string> {
  const [article, fileLinks, dbTables] = await Promise.all([
    getArticleById(articleId),
    getArticleFileLinks(articleId),
    getArticleDbTables(articleId),
  ]);

  let context = `## Article: ${article.title}\n\n${article.contentMarkdown}`;

  if (article.technicalViewMarkdown) {
    context += `\n\n## Technical View\n${article.technicalViewMarkdown}`;
  }

  if (fileLinks.length > 0) {
    context += '\n\n## Related Source Files\n';
    for (const link of fileLinks) {
      context += `- ${link.filePath}`;
      if (link.aiSummary) context += `: ${link.aiSummary}`;
      context += '\n';
    }
  }

  if (dbTables.length > 0) {
    context += '\n\n## Related Database Tables\n';
    for (const table of dbTables) {
      context += `- ${table.tableName}: ${table.relevanceExplanation || ''}\n`;
    }
  }

  return context;
}
```

### Anti-Patterns to Avoid
- **Storing full UIMessage objects in the database:** The `UIMessage` type from Vercel AI SDK includes rendering metadata (`parts` array) that is client-specific. Store only `role` and `content` text in `ai_conversation_messages`. Reconstruct `UIMessage[]` when loading.
- **Blocking primary actions on notifications:** Never `await sendNotification()` in the critical path of comment creation, article save, or sync pipeline. Use fire-and-forget.
- **Re-rendering entire markdown on each stream token:** Use the memoized markdown block pattern (split with `marked.lexer`, memoize each block). Without this, performance degrades noticeably after ~500 words.
- **Loading all conversation messages client-side before sending:** Use `prepareSendMessagesRequest` to send only the latest message. Server loads history from DB. This is the official Vercel AI SDK recommended pattern.
- **Creating a notification queue/job system:** The project explicitly decided against pgboss. Notifications are simple fire-and-forget HTTP calls. No queue needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE streaming protocol | Custom SSE implementation | `streamText().toUIMessageStreamResponse()` | Handles SSE format, keep-alive pings, reconnection, abort |
| Chat state management | Custom useState/useReducer for messages | `useChat` hook from `@ai-sdk/react` | Manages message array, streaming status, error handling, abort |
| Streaming markdown render | Custom token-by-token renderer | `marked.lexer` + `react-markdown` + `memo` | Block-level memoization prevents re-render cascade |
| Slack DM delivery | Custom WebSocket Slack client | Simple `fetch` to `chat.postMessage` REST API | One POST call; Slack opens DM automatically when `channel` is a user ID |
| Email HTML templates | Complex template engine | Simple template literal functions | Notifications are short; no need for mjml/handlebars |

**Key insight:** Both Slack and SendGrid are single-endpoint HTTP calls in this use case. Adding SDKs would add hundreds of KB of dependencies for literally one function each. Raw `fetch` with proper error handling is the right call.

## Common Pitfalls

### Pitfall 1: UIMessage Serialization Mismatch
**What goes wrong:** Saving the full `UIMessage` object (with `parts` array, `metadata`) to the database, then failing to reconstruct it correctly when loading.
**Why it happens:** `UIMessage` has a specific structure with `parts: Array<{ type: 'text', text: string } | ...>` that differs from the simple `role`/`content` the database stores.
**How to avoid:** Store only `role` and `content` (extracted from the text part) in `ai_conversation_messages`. When loading, reconstruct `UIMessage[]` with `id`, `role`, and `parts: [{ type: 'text', text: content }]`.
**Warning signs:** Chat fails to load previous conversations; type errors when passing loaded messages to `useChat`.

### Pitfall 2: System Prompt in Stored Messages
**What goes wrong:** The system prompt (which includes article context) gets stored as a message in the conversation, bloating the database and causing context to be stale on reload.
**Why it happens:** If you prepend system messages to the `messages` array instead of using the `system` parameter of `streamText`.
**How to avoid:** Always use the `system` parameter of `streamText`, never include system messages in the persisted conversation. Context is always assembled fresh on each request.
**Warning signs:** Conversations take up massive DB space; context becomes stale.

### Pitfall 3: Slack Bot Token Scope Mismatch
**What goes wrong:** The bot token doesn't have `chat:write` scope, so DMs fail silently or with cryptic errors.
**Why it happens:** Admin creates a Slack app but doesn't add the `chat:write` bot scope.
**How to avoid:** The test notification button should call `auth.test` to verify the token, then actually send a test DM. Document required scopes (`chat:write`) in the UI help text.
**Warning signs:** Test connection passes (auth.test works) but actual DMs fail.

### Pitfall 4: SendGrid Sender Verification
**What goes wrong:** Emails fail with 403 Forbidden because the "from" email isn't verified in SendGrid.
**Why it happens:** SendGrid requires domain or single-sender verification before sending.
**How to avoid:** The test button should actually send a test email (to the admin's own email). Display the error message if it fails. Add help text about sender verification.
**Warning signs:** API key is valid but emails never arrive; 403 errors in logs.

### Pitfall 5: Missing Conversation Cleanup
**What goes wrong:** Orphaned conversations accumulate when articles are deleted.
**Why it happens:** The `ai_conversations.articleId` has `ON DELETE CASCADE`, so conversations are deleted when articles are. But if conversations reference articles that don't exist anymore by other means, they can become orphans.
**How to avoid:** The schema already has `onDelete: 'cascade'` on `articleId`. This is handled. For global conversations, provide explicit delete functionality (ASKI-06).
**Warning signs:** None if cascade is working.

### Pitfall 6: Streaming Response Abort Not Handled
**What goes wrong:** User navigates away during streaming, but the server-side stream keeps running, wasting API credits.
**Why it happens:** `streamText` doesn't automatically detect client disconnect.
**How to avoid:** The `req.signal` (AbortSignal) from the Next.js request can be passed to `streamText` via the `abortSignal` parameter. `useChat` provides a `stop()` method on the client.
**Warning signs:** High API costs; slow responses from resource exhaustion.

## Code Examples

### Verified: useChat with Custom Body (AI SDK v6)
```typescript
// Source: https://ai-sdk.dev/cookbook/next/send-custom-body-from-use-chat
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const { messages, sendMessage, status, stop } = useChat({
  id: conversationId,
  messages: initialMessages, // UIMessage[] loaded from DB
  transport: new DefaultChatTransport({
    api: '/api/chat',
    prepareSendMessagesRequest: ({ id, messages }) => ({
      body: {
        conversationId: id,
        message: messages[messages.length - 1],
      },
    }),
  }),
  experimental_throttle: 50,
  onError: (error) => {
    toast.error('Failed to get AI response');
    console.error(error);
  },
});
```

### Verified: streamText API Route Handler (AI SDK v6)
```typescript
// Source: https://ai-sdk.dev/docs/getting-started/nextjs-app-router
import { streamText, convertToModelMessages } from 'ai';

export async function POST(req: Request) {
  const { conversationId, message } = await req.json();

  const model = await getAIModel();
  const priorMessages = await loadMessages(conversationId);
  priorMessages.push(message);

  const result = streamText({
    model,
    system: systemPromptWithContext,
    messages: await convertToModelMessages(priorMessages),
    abortSignal: req.signal, // Handles client disconnect
  });

  result.consumeStream(); // Ensure stream completes even on disconnect

  return result.toUIMessageStreamResponse({
    onFinish: async ({ messages }) => {
      await saveMessages(conversationId, messages);
    },
  });
}
```

### Verified: Memoized Markdown for Streaming
```typescript
// Source: https://ai-sdk.dev/cookbook/next/markdown-chatbot-with-memoization
import { marked } from 'marked';
import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map(token => token.raw);
}

const MemoizedMarkdownBlock = memo(
  ({ content }: { content: string }) => {
    return <ReactMarkdown>{content}</ReactMarkdown>;
  },
  (prevProps, nextProps) => prevProps.content === nextProps.content,
);

export const MemoizedMarkdown = memo(
  ({ content, id }: { content: string; id: string }) => {
    const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);
    return blocks.map((block, index) => (
      <MemoizedMarkdownBlock content={block} key={`${id}-block_${index}`} />
    ));
  },
);
```

### Slack DM via Raw Fetch
```typescript
// Source: https://docs.slack.dev/reference/methods/chat.postMessage/
export async function sendSlackDM(
  slackUserId: string,
  text: string
): Promise<void> {
  const botToken = await getSetting(SETTING_KEYS.slack_bot_token);
  if (!botToken) throw new Error('Slack bot token not configured');

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: slackUserId, // Slack auto-opens DM when channel is user ID
      text,
    }),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }
}
```

### SendGrid Email via Raw Fetch
```typescript
// Source: https://www.twilio.com/docs/sendgrid/for-developers/sending-email/quickstart-nodejs
export async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string
): Promise<void> {
  const [apiKey, fromEmail] = await Promise.all([
    getSetting(SETTING_KEYS.sendgrid_api_key),
    getSetting(SETTING_KEYS.sendgrid_from_email),
  ]);
  if (!apiKey) throw new Error('SendGrid API key not configured');
  if (!fromEmail) throw new Error('SendGrid from email not configured');

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail },
      subject,
      content: [{ type: 'text/html', value: htmlContent }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`SendGrid API error: ${response.status} - ${errorBody}`);
  }
}
```

### Slack Token Test
```typescript
// For admin test button: POST /api/admin/settings/test-notification
export async function testSlackToken(botToken: string): Promise<{ ok: boolean; botName?: string; error?: string }> {
  const response = await fetch('https://slack.com/api/auth.test', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await response.json();
  if (data.ok) {
    return { ok: true, botName: data.bot_id || data.user };
  }
  return { ok: false, error: data.error };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useChat` with `append()` | `useChat` with `sendMessage()` | AI SDK v5->v6 | `append` replaced by `sendMessage({ text })` |
| `messages` array with `content` string | `messages` with `parts` array | AI SDK v5->v6 | Must iterate `message.parts` to render, check `part.type === 'text'` |
| `result.toDataStreamResponse()` | `result.toUIMessageStreamResponse()` | AI SDK v5->v6 | New method name, returns proper UIMessage stream protocol |
| Custom SSE implementation | Built-in SSE with reconnection | AI SDK v6 | `x-vercel-ai-ui-message-stream: v1` header, ping/reconnect built in |

**Deprecated/outdated:**
- `append()` method on useChat: Replaced by `sendMessage()` in AI SDK v5+
- `content` string on messages: Now `parts` array with typed objects
- `toDataStreamResponse()`: Renamed to `toUIMessageStreamResponse()` in v6
- `@sendgrid/mail` SDK: Unnecessary for single-endpoint use; raw fetch preferred for minimal dependency
- `@slack/web-api` SDK: Same reasoning; raw fetch for `chat.postMessage` only

## Existing Infrastructure Summary

### Already in Schema (No Migration Needed)
- `ai_conversations` table: `id`, `userId`, `articleId` (nullable), `mode` (global/page), `title`, timestamps
- `ai_conversation_messages` table: `id`, `conversationId`, `role` (user/assistant), `content`, `createdAt`
- `mentions` table: `commentId`, `mentionedUserId` -- already populated by comment creation
- `users` columns: `notifySlackEnabled`, `slackUserId`, `notifyEmailEnabled`, `notifyOnMention`, `notifyOnActivity`

### Already in Settings (Seeded)
- `slack_bot_token` (secret)
- `sendgrid_api_key` (secret)
- `sendgrid_from_email`
- `ask_ai_global_prompt`
- `ask_ai_page_prompt`

### Already in UI
- Admin settings: Slack bot token input field, SendGrid API key + from email fields (missing test buttons)
- Admin settings: Global and page Ask AI prompt textareas
- User profile: Notification preference toggles (channels + types)
- Header layout in `(wiki)/layout.tsx`: Has a gap between `SidebarTrigger` and `SearchInput` where the Ask AI button fits

### Queries Available
- `getArticleIndex()` in `src/lib/ai/analyze.ts` -- returns article titles, slugs, descriptions
- `getFullCategoryTree()` in `src/lib/ai/analyze.ts` -- returns full category hierarchy
- `getArticleFileLinks(articleId)` in `src/lib/wiki/queries.ts` -- returns file links with AI summaries
- `getArticleDbTables(articleId)` in `src/lib/wiki/queries.ts` -- returns DB table mappings

## Notification Trigger Points

| Event | Where It Fires | Who Gets Notified | Preference Check |
|-------|---------------|-------------------|-----------------|
| @mention in comment | `POST /api/articles/[id]/comments` (already extracts mentions) | Mentioned user | `notifyOnMention` |
| New comment on article | `POST /api/articles/[id]/comments` | Users who edited or commented on article | `notifyOnActivity` |
| AI sync update to article | `runAIPipeline()` in `src/lib/ai/pipeline.ts` | Users who edited the article (`lastHumanEditorId`) | `notifyOnActivity` |
| AI conflict flag | `resolveConflict()` in `src/lib/merge/conflict.ts` (sets `needsReview`) | Users who edited the article | `notifyOnActivity` |

## Open Questions

1. **Conversation title generation**
   - What we know: `ai_conversations` has a `title` column. Useful for listing past conversations.
   - What's unclear: Should the title be auto-generated from the first message, or user-editable?
   - Recommendation: Auto-generate from the first user message (first 80 chars). Can be refined later.

2. **Context size limits for page-level Ask AI**
   - What we know: Article content + technical view + file summaries + DB tables can be large. OpenRouter models have varying context windows.
   - What's unclear: Whether we need to truncate or summarize context before passing to the model.
   - Recommendation: Assemble all context, truncate to ~8000 tokens if total exceeds limit. Log a warning when truncation occurs. Use the primary model (not summary model) for Ask AI.

3. **"New comment" notification scope**
   - What we know: NOTF-04 says "New comment on article notifies users who have commented on or edited that article."
   - What's unclear: Should the comment author be excluded? Should resolved-comment authors be included?
   - Recommendation: Exclude the comment author. Include all users who have any comment on the article OR who are listed as `lastHumanEditorId`. This requires a query joining `comments` and `articles` tables.

## Sources

### Primary (HIGH confidence)
- Vercel AI SDK v6 Official Docs: `useChat` API reference - https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
- Vercel AI SDK Cookbook: Send Custom Body - https://ai-sdk.dev/cookbook/next/send-custom-body-from-use-chat
- Vercel AI SDK Cookbook: Chatbot Message Persistence - https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
- Vercel AI SDK Cookbook: Markdown Chatbot with Memoization - https://ai-sdk.dev/cookbook/next/markdown-chatbot-with-memoization
- Vercel AI SDK Getting Started: Next.js App Router - https://ai-sdk.dev/docs/getting-started/nextjs-app-router
- Slack API: chat.postMessage - https://docs.slack.dev/reference/methods/chat.postMessage/
- SendGrid Node.js Quickstart - https://www.twilio.com/docs/sendgrid/for-developers/sending-email/quickstart-nodejs

### Secondary (MEDIUM confidence)
- Vercel AI SDK Stream Protocol - https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
- Slack API: conversations.open - https://docs.slack.dev/reference/methods/conversations.open/
- Slack API: auth.test - https://docs.slack.dev/reference/methods/auth.test/

### Codebase (HIGH confidence)
- Existing schema: `src/lib/db/schema.ts` -- ai_conversations, ai_conversation_messages, mentions, users
- Existing AI client: `src/lib/ai/client.ts` -- getAIModel(), getSummaryModel()
- Existing settings: `src/lib/settings/constants.ts` -- all needed keys present
- Existing comment route: `src/app/api/articles/[id]/comments/route.ts` -- mention extraction
- Existing notification form: `src/app/(wiki)/profile/notification-form.tsx` -- preference UI
- Existing admin API keys: `src/app/(admin)/admin/settings/api-keys-settings.tsx` -- Slack/SendGrid fields
- Existing test connection: `src/app/api/admin/settings/test-connection/route.ts` -- pattern for test buttons
- Existing pipeline: `src/lib/ai/pipeline.ts` -- where AI sync notifications fire
- Existing wiki layout: `src/app/(wiki)/layout.tsx` -- header where Ask AI button goes
- Existing Sheet component: `src/components/ui/sheet.tsx` -- slide-out panel for chat

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vercel AI SDK v6 is already installed and documented; Slack/SendGrid REST APIs are stable
- Architecture: HIGH - Based on official Vercel AI SDK patterns (persistence, custom body, memoization) and existing codebase patterns
- Pitfalls: HIGH - Well-documented from official sources and known patterns

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (stable domain; AI SDK v6 is current)
