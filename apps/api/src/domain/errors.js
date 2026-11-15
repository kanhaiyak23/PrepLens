/** Base of every failure the API raises on purpose (ADR-19). Anything else becomes INTERNAL. */
export class AppError extends Error {
    fields;
    constructor(message, fields) {
        super(message);
        this.fields = fields;
        this.name = new.target.name;
    }
}
export class ValidationError extends AppError {
    code = "VALIDATION_FAILED";
    httpStatus = 400;
}
export class AuthenticationError extends AppError {
    code = "UNAUTHENTICATED";
    httpStatus = 401;
}
export class ForbiddenError extends AppError {
    code = "FORBIDDEN";
    httpStatus = 403;
}
export class NotFoundError extends AppError {
    code = "NOT_FOUND";
    httpStatus = 404;
}
export class ConflictError extends AppError {
    code = "CONFLICT";
    httpStatus = 409;
}
export class RateLimitedError extends AppError {
    code = "RATE_LIMITED";
    httpStatus = 429;
}
export class NotEnoughDataError extends AppError {
    code = "NOT_ENOUGH_DATA";
    httpStatus = 409;
}
export class UpstreamError extends AppError {
    code = "UPSTREAM_UNAVAILABLE";
    httpStatus = 503;
}
/**
 * The database raises P0001 with "CODE: message" (see docs/design/08 section 8.7).
 * Translate that into the matching AppError so the HTTP layer never sees SQL.
 */
export function fromDbMessage(message) {
    const m = /^(UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|CONFLICT|VALIDATION):\s*(.*)$/s.exec(message);
    if (!m)
        return null;
    const [, code, text] = m;
    const msg = text ?? message;
    switch (code) {
        case "UNAUTHENTICATED": return new AuthenticationError(msg);
        case "FORBIDDEN": return new ForbiddenError(msg);
        case "NOT_FOUND": return new NotFoundError(msg);
        case "CONFLICT": return new ConflictError(msg);
        default: return new ValidationError(msg);
    }
}
/** Any PostgREST error to an AppError. Constraint violations are the database enforcing a rule, so they are the caller's fault, not ours. */
export function fromDbError(error) {
    const known = fromDbMessage(error.message);
    if (known)
        return known;
    switch (error.code) {
        case "23514": return new ValidationError("That change breaks a rule of the archive.");
        case "23505": return new ConflictError("That already exists.");
        case "23503": return new NotFoundError("A referenced item does not exist.");
        case "42501": return new ForbiddenError("You are not allowed to do that.");
        default: return new UpstreamError("The archive is temporarily unavailable.");
    }
}
