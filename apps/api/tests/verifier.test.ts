/**
 * The token verifier accepts only signed-in user tokens (ADR-33). getClaims() is stubbed: the signature check itself
 * is Supabase's; what we test is that our adapter refuses anything that is not a real, authenticated user.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseTokenVerifier } from "../src/infrastructure/supabase/SupabaseTokenVerifier.js";
import { AuthenticationError } from "../src/domain/errors.js";

const withClaims = (result: { data: unknown; error: unknown }) =>
  new SupabaseTokenVerifier({ auth: { getClaims: async () => result } } as unknown as SupabaseClient);

const user = { sub: "11111111-1111-4111-8111-111111111111", email: "Asha@NST.rishihood.edu.in", role: "authenticated" };

describe("SupabaseTokenVerifier", () => {
  it("accepts a valid user token and lowercases the email", async () => {
    await expect(withClaims({ data: { claims: user }, error: null }).verify("t")).resolves.toEqual({ userId: user.sub, email: "asha@nst.rishihood.edu.in" });
  });

  it.each([
    ["a bad signature or expired token", { data: null, error: new Error("invalid JWT") }],
    ["the anon role", { data: { claims: { ...user, role: "anon" } }, error: null }],
    ["a token without a user id", { data: { claims: { ...user, sub: undefined } }, error: null }],
    ["a token without an email", { data: { claims: { ...user, email: "" } }, error: null }],
  ])("rejects %s", async (_name, result) => {
    await expect(withClaims(result).verify("t")).rejects.toBeInstanceOf(AuthenticationError);
  });
});
