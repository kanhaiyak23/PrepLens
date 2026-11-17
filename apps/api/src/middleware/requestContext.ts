import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Logger } from "../lib/logger.js";

const WELL_FORMED = /^[A-Za-z0-9_-]{8,64}$/;

/** Stamps a request id on the request, the response header, and every log line (ADR-19). */
export function requestContext(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const inbound = req.header("x-request-id");
    // An inbound id is accepted only if well formed, so log correlation is not a place untrusted input lands.
    const requestId = inbound && WELL_FORMED.test(inbound) ? inbound : randomUUID();
    res.setHeader("x-request-id", requestId);
    res.locals.requestId = requestId;
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      logger.info({ requestId, method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms) }, "request");
    });
    next();
  };
}
