import pino from "pino";
export function createLogger(level) {
    return pino({ level, redact: ["req.headers.authorization", "*.email", "*.token"] });
}
