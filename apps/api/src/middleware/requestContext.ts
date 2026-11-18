/**
 * middleware/requestContext.ts — GIVES EVERY REQUEST AN ID AND LOGS IT
 *
 * What it does: the first thing that runs. It gives the request a unique id, sends that id back in the
 * "x-request-id" response header, and when the response finishes, writes one log line:
 * method, path, status code and how many milliseconds it took.
 *
 * System design:
 * - Observability / tracing (ADR-19): the same id appears in the response, in error messages and in every log line,
 *   so one request can be followed end to end.
 * - Never trust input: if the caller sends their own id, it is only accepted if it looks safe (letters, digits, _ and -);
 *   otherwise we generate a fresh one, so nobody can inject junk into our logs.
 */
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Logger } from "../lib/logger.js";

const WELL_FORMED = /^[A-Za-z0-9_-]{8,64}$/; // what a safe incoming request id looks like

export function requestContext(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const inbound = req.header("x-request-id");
    const requestId = inbound && WELL_FORMED.test(inbound) ? inbound : randomUUID();
    res.setHeader("x-request-id", requestId);
    res.locals.requestId = requestId;
    // Measure how long the request takes, and log it once the response is sent.
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      logger.info({ requestId, method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms) }, "request");
    });
    next();
  };
}
