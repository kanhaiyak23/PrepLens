/**
 * domain/viewer.ts — WHO IS CALLING THE API
 *
 * What it does: describes the caller. Either a "visitor" (not signed in) or a "user" with their id, email,
 * role (student or admin) and login token. Plus two small helpers: isSignedIn() and isAdmin().
 *
 * System design:
 * - Discriminated union (a TypeScript type with a "kind" tag): the compiler forces code to check
 *   "is this a user?" before reading an id or role, so a visitor can never be treated like a user by mistake.
 * - Security: a Viewer is built ONLY from the verified token and the database (see authenticate.ts),
 *   never from anything the browser sends in the body.
 */
import type { Role } from "@preplens/shared";

export type Viewer =
  | { kind: "visitor" }
  | { kind: "user"; id: string; email: string; role: Role; token: string };

/** True if signed in. TypeScript then knows v has an id, email, role and token. */
export const isSignedIn = (v: Viewer): v is Extract<Viewer, { kind: "user" }> => v.kind === "user";
/** True only for a signed-in admin. Used by every admin service as its permission check. */
export const isAdmin = (v: Viewer): boolean => v.kind === "user" && v.role === "admin";
