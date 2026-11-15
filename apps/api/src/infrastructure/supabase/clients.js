import { createClient } from "@supabase/supabase-js";
const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
/**
 * A client that runs as the caller (ADR-23): Postgres evaluates RLS and auth.uid() for this user.
 * Created per request. Never shared, because it carries one user's token.
 */
export function createUserClient(cfg, token) {
    return createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: noSession,
        global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    });
}
/** The master key. Only the infrastructure layer may call this, for the short list in docs/design/08 section 8.6. */
export function createServiceClient(cfg) {
    return createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, { auth: noSession });
}
