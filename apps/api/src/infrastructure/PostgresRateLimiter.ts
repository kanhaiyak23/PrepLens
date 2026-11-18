/**
 * infrastructure/PostgresRateLimiter.ts — COUNTS REQUESTS IN THE DATABASE
 *
 * What it does: implements the RateLimiter interface. It calls the database function check_rate_limit, which adds one
 * to this user's counter for this action and answers true (allowed) or false (over the limit).
 *
 * System design:
 * - Adapter: plugs Postgres into the RateLimiter port. The middleware never knows where counts are stored.
 * - Shared state for horizontal scaling (ADR-11): counts live in Postgres, not in server memory, so every copy of the API
 *   sees the same numbers, and a restart doesn't reset anyone's limit.
 * - Atomic counting: the add-and-check happens in one database statement, so two requests at the same moment
 *   can't both slip under the limit.
 * - Uses the service (system) key, because the rate-limit table is not something users should read or write.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RateLimiter } from "../domain/ports.js";
import { UpstreamError } from "../domain/errors.js";

export class PostgresRateLimiter implements RateLimiter {
  constructor(private readonly service: SupabaseClient) {}

  async consume(key: string, action: string, limit: number, windowSeconds: number): Promise<boolean> {
    const { data, error } = await this.service.rpc("check_rate_limit", {
      p_key: key, p_action: action, p_limit: limit, p_window_seconds: windowSeconds,
    });
    if (error) throw new UpstreamError("Rate limiting is temporarily unavailable."); // fail closed: no count, no action
    return data === true;
  }
}
