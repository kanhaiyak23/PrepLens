import type { SupabaseClient } from "@supabase/supabase-js";
import type { RateLimiter } from "../domain/ports.js";
import { UpstreamError } from "../domain/errors.js";

/** Rate-limit state lives in Postgres so every serverless instance sees the same counters (ADR-11). Service role only. */
export class PostgresRateLimiter implements RateLimiter {
  constructor(private readonly service: SupabaseClient) {}

  async consume(key: string, action: string, limit: number, windowSeconds: number): Promise<boolean> {
    const { data, error } = await this.service.rpc("check_rate_limit", {
      p_key: key, p_action: action, p_limit: limit, p_window_seconds: windowSeconds,
    });
    if (error) throw new UpstreamError("Rate limiting is temporarily unavailable.");
    return data === true;
  }
}
