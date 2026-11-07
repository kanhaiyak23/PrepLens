import pino from "pino";

export function createLogger(level: string) {
  return pino({ level, redact: ["req.headers.authorization", "*.email", "*.token"] });
}
export type Logger = ReturnType<typeof createLogger>;
