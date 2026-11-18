/**
 * config/env.ts — READS AND CHECKS THE SETTINGS (.env)
 *
 * What it does: reads environment variables (database address, keys, website URL, AI key) and checks each one
 * with a Zod schema. If anything is missing or wrong, it throws a readable list of problems.
 *
 * System design:
 * - Configuration outside the code (12-factor app): secrets and addresses come from the environment,
 *   never written in the code, so the same code runs locally and on Render with different settings.
 * - Fail fast: bad settings stop the server at start-up, instead of causing confusing errors later.
 * - Validation at the boundary: the environment is input from outside, so it is validated like any other input.
 */
import { z } from "zod";

// The rules every setting must follow.
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),          // public key: requests run as the user, with database security rules
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),  // powerful key: server only, never sent to the browser
  // The website's address, used for CORS. Must be exact: no trailing slash, and never "*" (that would allow any website).
  FRONTEND_URL: z.string().url().refine((u) => !u.endsWith("/") && u !== "*", "No trailing slash, and never *"),
  GEMINI_API_KEY: z.string().optional(),          // optional: without it, only the AI guide is switched off
  // AI models tried in order. Only temporary failures (busy, server error, timeout) move on to the next one.
  GEMINI_MODELS: z.string().default("gemini-2.5-flash,gemini-2.5-flash-lite"),
});

export type Config = z.infer<typeof schema>;

/** Checks the settings at start-up. On failure, throws a clear list like "SUPABASE_URL: Invalid url". */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${lines}\nSee apps/api/.env.example`);
  }
  return parsed.data;
}
