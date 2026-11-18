/**
 * domain/errors.ts — ALL THE ERRORS THE API CAN RAISE ON PURPOSE
 *
 * What it does:
 *   - AppError: the parent class. Every error has a code (e.g. "FORBIDDEN"), an HTTP status (e.g. 403),
 *     a message, and optionally which fields were wrong.
 *   - One child class per kind of problem (table below).
 *   - fromDbMessage() / fromDbError(): translate database errors into these classes, so no SQL detail ever
 *     reaches the user.
 *
 *     ValidationError     400  bad input
 *     AuthenticationError 401  not signed in
 *     ForbiddenError      403  signed in, but not allowed
 *     NotFoundError       404  doesn't exist (or is hidden from you)
 *     ConflictError       409  the state changed (e.g. another admin already approved it)
 *     NotEnoughDataError  409  e.g. a company has too few posts for an AI guide
 *     RateLimitedError    429  too many requests
 *     UpstreamError       503  the database or AI is unavailable
 *
 * System design:
 * - Inheritance + polymorphism: the error handler only needs to know "is it an AppError?" and then reads
 *   code and httpStatus — it never needs a list of every error type.
 * - Consistent error contract (ADR-19): the same codes are shared with the website (@preplens/shared).
 * - Translation layer: the database raises messages like "FORBIDDEN: Admins only." and constraint codes; these
 *   functions turn them into proper HTTP errors, keeping SQL out of the HTTP layer.
 */
import type { ErrorCode } from "@preplens/shared";

/** Abstract parent: you never create an AppError directly, only one of its children. */
export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;
  abstract readonly httpStatus: number;
  constructor(message: string, readonly fields?: Record<string, string>) {
    super(message);
    this.name = new.target.name; // e.g. "ForbiddenError", useful in logs
  }
}

export class ValidationError extends AppError {
  readonly code = "VALIDATION_FAILED" as const;
  readonly httpStatus = 400;
}
export class AuthenticationError extends AppError {
  readonly code = "UNAUTHENTICATED" as const;
  readonly httpStatus = 401;
}
export class ForbiddenError extends AppError {
  readonly code = "FORBIDDEN" as const;
  readonly httpStatus = 403;
}
export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND" as const;
  readonly httpStatus = 404;
}
export class ConflictError extends AppError {
  readonly code = "CONFLICT" as const;
  readonly httpStatus = 409;
}
export class RateLimitedError extends AppError {
  readonly code = "RATE_LIMITED" as const;
  readonly httpStatus = 429;
}
export class NotEnoughDataError extends AppError {
  readonly code = "NOT_ENOUGH_DATA" as const;
  readonly httpStatus = 409;
}
export class UpstreamError extends AppError {
  readonly code = "UPSTREAM_UNAVAILABLE" as const;
  readonly httpStatus = 503;
}

/**
 * Our database functions raise errors as "CODE: message", e.g. "FORBIDDEN: Admins only.".
 * This reads the code and returns the matching error class. Not in that format -> null.
 */
export function fromDbMessage(message: string): AppError | null {
  const m = /^(UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|CONFLICT|VALIDATION):\s*(.*)$/s.exec(message);
  if (!m) return null;
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

/**
 * Any database error -> an AppError. When a database rule (constraint) blocks something, that is the caller's
 * mistake (4xx), not a server crash. Postgres codes: 23514 check rule broken, 23505 duplicate,
 * 23503 refers to something missing, 42501 no permission. Anything else -> 503 "temporarily unavailable".
 */
export function fromDbError(error: { message: string; code?: string }): AppError {
  const known = fromDbMessage(error.message);
  if (known) return known;
  switch (error.code) {
    case "23514": return new ValidationError("That change breaks a rule of the archive.");
    case "23505": return new ConflictError("That already exists.");
    case "23503": return new NotFoundError("A referenced item does not exist.");
    case "42501": return new ForbiddenError("You are not allowed to do that.");
    default: return new UpstreamError("The archive is temporarily unavailable.");
  }
}
