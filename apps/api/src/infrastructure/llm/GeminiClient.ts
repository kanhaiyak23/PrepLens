/**
 * infrastructure/llm/GeminiClient.ts — TALKS TO GOOGLE GEMINI
 *
 * What it does: sends our instructions and prompt to Gemini over HTTPS, asks for JSON in our exact shape,
 * and returns the parsed JSON. Turns every failure (timeout, HTTP error, broken JSON) into a clean error.
 *
 * System design:
 * - Adapter (Ports and Adapters): turns our simple LlmClient interface into Gemini's HTTP API.
 *   Nothing Gemini-specific leaks outside this class, so switching AI provider = writing one new adapter.
 * - Timeouts: a request that takes over 25 seconds is cancelled, so a slow AI can't hang our server.
 * - Security: the API key goes in a header, never in the URL, so it can't end up in any access log.
 *   The AI provider's raw error text (which might mention keys or quotas) is logged, never sent to the user.
 * - Low temperature (0.2): answers stay factual and consistent rather than creative.
 */
import type { LlmClient, LlmRequest, LlmResult } from "../../domain/ports.js";
import { UpstreamError } from "../../domain/errors.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * HTTP statuses where trying another model makes sense: 429 (rate limit) and 5xx (overloaded / down), plus 404
 * because a model can be retired while the next one still works. A bad request (400) fails everywhere, so it isn't retried.
 */
export const TRANSIENT = new Set([404, 429, 500, 502, 503, 504]);

/** An AI failure. The user only sees the generic message; the real details stay in `detail` for our logs. */
export class LlmHttpError extends UpstreamError {
  constructor(readonly status: number, readonly detail: string) {
    super("The AI guide is temporarily unavailable.");
  }
}

export class GeminiClient implements LlmClient {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,                    // e.g. "gemini-2.5-flash"
    private readonly fetchImpl: typeof fetch = fetch,  // injectable, so tests can fake the network
    private readonly timeoutMs = 25_000,
  ) {}

  async generateJson(req: LlmRequest): Promise<LlmResult> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${BASE}/models/${this.model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: "user", parts: [{ text: req.prompt }] }],
          // Ask for JSON that matches our schema (structured output).
          generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: req.schema },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new LlmHttpError(504, "The AI service did not answer in time."); // timeout or network failure
    }
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string }; candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
    if (!res.ok) throw new LlmHttpError(res.status, body.error?.message ?? `The AI service failed (${res.status}).`);
    // Join the answer's text parts, skipping the model's internal "thinking" parts.
    const text = (body.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
    try {
      return { data: JSON.parse(text), model: this.model };
    } catch {
      throw new LlmHttpError(502, "The AI service returned malformed JSON.");
    }
  }
}
