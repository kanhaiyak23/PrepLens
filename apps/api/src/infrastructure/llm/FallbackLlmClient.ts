import type { LlmClient, LlmRequest, LlmResult } from "../../domain/ports.js";
import { UpstreamError } from "../../domain/errors.js";
import { LlmHttpError, TRANSIENT } from "./GeminiClient.js";

/**
 * Decorator: wraps several LlmClients and tries them in order. It adds resilience without changing the interface,
 * so GuideService cannot tell it from a single client (Open/Closed, Liskov). Free-tier models are often overloaded or rate limited.
 */
export class FallbackLlmClient implements LlmClient {
  constructor(private readonly clients: LlmClient[]) {
    if (clients.length === 0) throw new Error("FallbackLlmClient needs at least one client.");
  }

  async generateJson(req: LlmRequest): Promise<LlmResult> {
    let last: unknown;
    for (const c of this.clients) {
      try {
        return await c.generateJson(req);
      } catch (err) {
        last = err;
        // Only transient failures move on; a rejected request fails identically on every model.
        if (!(err instanceof LlmHttpError) || !TRANSIENT.has(err.status)) throw err;
      }
    }
    throw last instanceof UpstreamError ? last : new UpstreamError("All AI models are busy. Please try again shortly.");
  }
}
