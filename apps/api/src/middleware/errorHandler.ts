import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import type { ApiErrorBody } from "@preplens/shared";
import { AppError, NotFoundError } from "../domain/errors.js";
import type { Logger } from "../lib/logger.js";

export const notFound = (_req: Request, _res: Response, next: NextFunction) => next(new NotFoundError("Route not found."));

/** One error envelope everywhere (ADR-19). Unknown errors are logged in full and returned as a generic 500. */
export function errorHandler(logger: Logger) {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const requestId = String(res.locals.requestId ?? "unknown");
    let status = 500;
    let body: ApiErrorBody["error"] = { code: "INTERNAL", message: "Something went wrong on our side." };

    if (err instanceof AppError) {
      status = err.httpStatus;
      body = { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) };
    } else if (err instanceof ZodError) {
      status = 400;
      body = { code: "VALIDATION_FAILED", message: "Some fields are not valid.", fields: Object.fromEntries(err.issues.map((i) => [i.path.join("."), i.message])) };
    } else if (typeof err === "object" && err && "type" in err && (err as { type: string }).type === "entity.too.large") {
      status = 413;
      body = { code: "VALIDATION_FAILED", message: "The request is too large." };
    } else if (typeof err === "object" && err && "type" in err && (err as { type: string }).type === "entity.parse.failed") {
      status = 400;
      body = { code: "VALIDATION_FAILED", message: "The request body is not valid JSON." };
    } else {
      logger.error({ err, requestId }, "unhandled error");
    }
    res.status(status).json({ error: body, requestId } satisfies ApiErrorBody);
  };
}
