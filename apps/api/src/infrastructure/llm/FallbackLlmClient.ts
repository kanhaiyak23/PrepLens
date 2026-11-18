/**
 * infrastructure/llm/FallbackLlmClient.ts — "IF ONE AI MODEL FAILS, TRY THE NEXT"
 *
 * What it does: holds a list of AI clients (e.g. gemini-2.5-flash, then gemini-2.5-flash-lite) and tries them in order.
 * If a model is busy, rate-limited or down, it moves on to the next. If the request itself is bad, it stops at once
 * (every model would reject it the same way).
 *
 * System design:
 * - Decorator pattern: it wraps other LlmClients and adds a "retry with backup" behaviour, while still looking exactly
 *   like a single LlmClient. GuideService can't tell the difference (Liskov Substitution, Open/Closed).
 * - Resilience / fault tolerance: free AI tiers are often overloaded; a fallback keeps the feature working.
 * - Only retry what can succeed: temporary errors (429, 5xx, timeout, retired model) move on; others fail fast.
 */
import type { LlmClient, LlmRequest, LlmResult } from "../../domain/ports.js";
import { UpstreamError } from "../../domain/errors.js";
import { LlmHttpError, TRANSIENT } from "./GeminiClient.js";

export class FallbackLlmClient implements LlmClient {
  constructor(private readonly clients: LlmClient[]) {
    if (clients.length === 0) throw new Error("FallbackLlmClient needs at least one client.");
  }

  async generateJson(req: LlmRequest): Promise<LlmResult> {
    let last: unknown;
    for (const c of this.clients) {
      try {
        return await c.generateJson(req); // first model that answers wins
      } catch (err) {
        last = err;
        // Temporary failure -> try the next model. Anything else -> stop now.
        if (!(err instanceof LlmHttpError) || !TRANSIENT.has(err.status)) throw err;
      }
    }
    throw last instanceof UpstreamError ? last : new UpstreamError("All AI models are busy. Please try again shortly.");
  }
}
