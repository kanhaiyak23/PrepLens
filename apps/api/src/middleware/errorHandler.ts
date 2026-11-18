/**
 * middleware/errorHandler.ts — ONE PLACE THAT TURNS ANY ERROR INTO A CLEAN RESPONSE
 *
 * What it does: every error thrown anywhere in the API ends up here. It picks the right HTTP status and returns
 * the same JSON shape every time:  { error: { code, message, fields? }, requestId }
 *
 * System design:
 * - Centralised error handling (ADR-19): no controller builds its own error response, so every error looks the same
 *   and the website can handle all of them in one way.
 * - Error envelope with a request id: a user can report the id, and we find the exact log line.
 * - Don't leak internals: our own errors (AppError) show their message; anything unexpected is logged in full
 *   on the server but the user only sees "Something went wrong on our side." (no stack traces, no database details).
 */
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import type { ApiErrorBody } from "@preplens/shared";
import { AppError, NotFoundError } from "../domain/errors.js";
import type { Logger } from "../lib/logger.js";

/** No route matched the URL -> 404 in the standard format. */
export const notFound = (_req: Request, _res: Response, next: NextFunction) => next(new NotFoundError("Route not found."));

export function errorHandler(logger: Logger) {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const requestId = String(res.locals.requestId ?? "unknown");
    // Default: an unexpected error -> 500 with a generic message.
    let status = 500;
    let body: ApiErrorBody["error"] = { code: "INTERNAL", message: "Something went wrong on our side." };

    if (err instanceof AppError) {
      // Our own known errors (validation, forbidden, not found, conflict...) carry their status and message.
      status = err.httpStatus;
      body = { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) };
    } else if (err instanceof ZodError) {
      // Input failed a validation schema -> 400 with which field is wrong.
      status = 400;
      body = { code: "VALIDATION_FAILED", message: "Some fields are not valid.", fields: Object.fromEntries(err.issues.map((i) => [i.path.join("."), i.message])) };
    } else if (typeof err === "object" && err && "type" in err && (err as { type: string }).type === "entity.too.large") {
      // Body bigger than 100 KB -> 413.
      status = 413;
      body = { code: "VALIDATION_FAILED", message: "The request is too large." };
    } else if (typeof err === "object" && err && "type" in err && (err as { type: string }).type === "entity.parse.failed") {
      // Body is not valid JSON -> 400.
      status = 400;
      body = { code: "VALIDATION_FAILED", message: "The request body is not valid JSON." };
    } else {
      // A real bug: log everything on the server, show the user only the generic message.
      logger.error({ err, requestId }, "unhandled error");
    }
    res.status(status).json({ error: body, requestId } satisfies ApiErrorBody);
  };
}
