import { UpstreamError } from "../domain/errors.js";
/** Rate-limit state lives in Postgres so every serverless instance sees the same counters (ADR-11). Service role only. */
export class PostgresRateLimiter {
    service;
    constructor(service) {
        this.service = service;
    }
    async consume(key, action, limit, windowSeconds) {
        const { data, error } = await this.service.rpc("check_rate_limit", {
            p_key: key, p_action: action, p_limit: limit, p_window_seconds: windowSeconds,
        });
        if (error)
            throw new UpstreamError("Rate limiting is temporarily unavailable.");
        return data === true;
    }
}
