import { UpstreamError } from "../../domain/errors.js";
const BASE = "https://generativelanguage.googleapis.com/v1beta";
/**
 * Statuses worth trying another model for: overload and rate limits (429, 5xx), and 404 because a model id can be
 * retired or renamed while the next one still works. A malformed request (400) fails the same way everywhere, so it is not retried.
 */
export const TRANSIENT = new Set([404, 429, 500, 502, 503, 504]);
/**
 * The message is deliberately generic because it can reach a client. The vendor's own wording (which can mention keys or quotas)
 * stays in `detail`, which is logged and never sent.
 */
export class LlmHttpError extends UpstreamError {
    status;
    detail;
    constructor(status, detail) {
        super("The AI guide is temporarily unavailable.");
        this.status = status;
        this.detail = detail;
    }
}
/**
 * Adapter (Hexagonal): translates our LlmClient port into Gemini's HTTP API. Nothing Gemini-shaped leaks past this class.
 * The key travels in a header, never the URL, so it cannot reach an access log.
 */
export class GeminiClient {
    apiKey;
    model;
    fetchImpl;
    timeoutMs;
    constructor(apiKey, model, fetchImpl = fetch, timeoutMs = 25_000) {
        this.apiKey = apiKey;
        this.model = model;
        this.fetchImpl = fetchImpl;
        this.timeoutMs = timeoutMs;
    }
    async generateJson(req) {
        let res;
        try {
            res = await this.fetchImpl(`${BASE}/models/${this.model}:generateContent`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: req.system }] },
                    contents: [{ role: "user", parts: [{ text: req.prompt }] }],
                    generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: req.schema },
                }),
                signal: AbortSignal.timeout(this.timeoutMs),
            });
        }
        catch {
            throw new LlmHttpError(504, "The AI service did not answer in time.");
        }
        const body = (await res.json().catch(() => ({})));
        if (!res.ok)
            throw new LlmHttpError(res.status, body.error?.message ?? `The AI service failed (${res.status}).`);
        const text = (body.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
        try {
            return { data: JSON.parse(text), model: this.model };
        }
        catch {
            throw new LlmHttpError(502, "The AI service returned malformed JSON.");
        }
    }
}
