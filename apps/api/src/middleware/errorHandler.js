import { ZodError } from "zod";
import { AppError, NotFoundError } from "../domain/errors.js";
export const notFound = (_req, _res, next) => next(new NotFoundError("Route not found."));
/** One error envelope everywhere (ADR-19). Unknown errors are logged in full and returned as a generic 500. */
export function errorHandler(logger) {
    return (err, _req, res, _next) => {
        const requestId = String(res.locals.requestId ?? "unknown");
        let status = 500;
        let body = { code: "INTERNAL", message: "Something went wrong on our side." };
        if (err instanceof AppError) {
            status = err.httpStatus;
            body = { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) };
        }
        else if (err instanceof ZodError) {
            status = 400;
            body = { code: "VALIDATION_FAILED", message: "Some fields are not valid.", fields: Object.fromEntries(err.issues.map((i) => [i.path.join("."), i.message])) };
        }
        else if (typeof err === "object" && err && "type" in err && err.type === "entity.too.large") {
            status = 413;
            body = { code: "VALIDATION_FAILED", message: "The request is too large." };
        }
        else if (typeof err === "object" && err && "type" in err && err.type === "entity.parse.failed") {
            status = 400;
            body = { code: "VALIDATION_FAILED", message: "The request body is not valid JSON." };
        }
        else {
            logger.error({ err, requestId }, "unhandled error");
        }
        res.status(status).json({ error: body, requestId });
    };
}
