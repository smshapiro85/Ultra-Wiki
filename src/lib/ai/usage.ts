/**
 * Token and cost tracking for AI pipeline runs.
 *
 * Accumulates input/output token counts and estimated cost (USD) across
 * all LLM calls in a single sync operation. OpenRouter includes a `cost`
 * field in providerMetadata; other providers fall back to token counts only.
 */

export interface UsageTracker {
  add(
    usage: {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    },
    providerMetadata?: Record<string, Record<string, unknown>> | undefined
  ): void;
}

export class SyncUsageTracker implements UsageTracker {
  totalInputTokens = 0;
  totalOutputTokens = 0;
  estimatedCostUsd = 0;

  add(
    usage: {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    },
    providerMetadata?: Record<string, Record<string, unknown>> | undefined
  ): void {
    this.totalInputTokens += usage.inputTokens ?? 0;
    this.totalOutputTokens += usage.outputTokens ?? 0;

    // Extract OpenRouter cost if available
    const openrouter = providerMetadata?.openrouter as
      | { usage?: { cost?: number } }
      | undefined;
    if (typeof openrouter?.usage?.cost === "number") {
      this.estimatedCostUsd += openrouter.usage.cost;
    }
  }
}
