import type { SupabaseClient } from "@supabase/supabase-js";
import type { TokenVerifier, VerifiedToken } from "../../domain/ports.js";
import { AuthenticationError } from "../../domain/errors.js";

/**
 * Adapter over Supabase Auth (ADR-22). auth.getUser asks the auth server to validate the signature and
 * expiry, which works for any signing setup. A local JWKS check is a later optimisation if latency matters.
 */
export class SupabaseTokenVerifier implements TokenVerifier {
  constructor(private readonly anon: SupabaseClient) {}

  async verify(token: string): Promise<VerifiedToken> {
    const { data, error } = await this.anon.auth.getUser(token);
    if (error || !data.user || !data.user.email) throw new AuthenticationError("Your session is not valid. Please sign in again.");
    return { userId: data.user.id, email: data.user.email.toLowerCase() };
  }
}
