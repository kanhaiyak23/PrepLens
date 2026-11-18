/**
 * infrastructure/supabase/clients.ts — THE TWO KINDS OF DATABASE CONNECTION
 *
 * What it does:
 *   - createUserClient(): a connection that acts AS the person calling (with their login token), or as an anonymous
 *     visitor. The database then applies its security rules (RLS) for that person.
 *   - createServiceClient(): the "master key" connection that bypasses those rules. Used ONLY for a short list of
 *     system jobs: rate-limit counters, the AI guide cache, and deleting an account.
 *
 * System design:
 * - Principle of least privilege (ADR-23): almost everything runs with the user's own rights, so even a bug in the API
 *   can't show a student data they aren't allowed to see.
 * - Secret management: the service key exists only on the server (never in the website, never in git).
 * - Stateless: no sessions are kept or refreshed on the server; each request brings its own token.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Config } from "../../config/env.js";

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

/** Runs as the caller: the database sees their user id (auth.uid()) and applies RLS. Made fresh per request, never shared. */
export function createUserClient(cfg: Pick<Config, "SUPABASE_URL" | "SUPABASE_ANON_KEY">, token?: string): SupabaseClient {
  return createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: noSession,
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

/** The master key. Only infrastructure code may use it, and only for the system jobs listed in docs/design/08 §8.6. */
export function createServiceClient(cfg: Pick<Config, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY">): SupabaseClient {
  return createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, { auth: noSession });
}
