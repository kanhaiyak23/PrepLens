/**
 * lib/logger.ts — WRITES THE SERVER'S LOGS
 *
 * What it does: creates a fast JSON logger (pino). Every log line is structured data, easy to search.
 *
 * System design:
 * - Observability: structured logs plus a request id on every line let us trace one request end to end.
 * - Privacy by default: login tokens and email addresses are automatically hidden ("redacted") from the logs,
 *   so personal data never ends up in log files.
 */
import pino from "pino";

export function createLogger(level: string) {
  return pino({ level, redact: ["req.headers.authorization", "*.email", "*.token"] });
}
export type Logger = ReturnType<typeof createLogger>;
