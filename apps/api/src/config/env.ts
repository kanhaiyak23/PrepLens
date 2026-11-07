import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  FRONTEND_URL: z.string().url().refine((u) => !u.endsWith("/") && u !== "*", "No trailing slash, and never *"),
  GEMINI_API_KEY: z.string().optional(),
  // Tried in order; only transient failures (429/5xx/timeout) move to the next. Model ids are an ASSUMPTION: override if Google renames them.
  GEMINI_MODELS: z.string().default("gemini-2.5-flash,gemini-2.5-flash-lite"),
});

export type Config = z.infer<typeof schema>;

/** Validate at boot and fail with a readable list, not a stack trace. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${lines}\nSee apps/api/.env.example`);
  }
  return parsed.data;
}
