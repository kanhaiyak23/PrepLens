/**
 * infrastructure/supabase/SupabaseTokenVerifier.ts — "IS THIS LOGIN TOKEN REAL?"
 *
 * What it does: checks the login token's signature and expiry. If valid, returns the user's id and email
 * (in lowercase). If not, throws 401 "Your session is not valid. Please sign in again."
 *
 * System design:
 * - Adapter: implements the TokenVerifier port using Supabase Auth, so the login middleware doesn't depend on Supabase.
 * - Token-based authentication (JWT, ADR-22, ADR-33): the project signs tokens with an asymmetric key (ES256).
 *   getClaims() checks the signature LOCALLY with Supabase's public key (fetched once, then cached), so a signed-in
 *   request no longer waits for a network round trip to the auth server. Speed: one fewer trip on EVERY signed-in call.
 * - Trade-off: a token that was signed out early stays valid until it expires (at most 1 hour). The role is still read
 *   from the database on every request, so removing someone's admin access works immediately.
 * - Only real user tokens are accepted: role must be "authenticated" and the token must carry a user id and email.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TokenVerifier, VerifiedToken } from "../../domain/ports.js";
import { AuthenticationError } from "../../domain/errors.js";

export class SupabaseTokenVerifier implements TokenVerifier {
  constructor(private readonly anon: SupabaseClient) {}

  async verify(token: string): Promise<VerifiedToken> {
    const { data, error } = await this.anon.auth.getClaims(token);
    const c = data?.claims;
    if (error || !c || c.role !== "authenticated" || typeof c.sub !== "string" || typeof c.email !== "string" || !c.email) {
      throw new AuthenticationError("Your session is not valid. Please sign in again.");
    }
    return { userId: c.sub, email: c.email.toLowerCase() };
  }
}
