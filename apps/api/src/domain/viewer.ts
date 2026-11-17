import type { Role } from "@preplens/shared";

/** Who is calling. Built only from a verified token and the database, never from the request body. */
export type Viewer =
  | { kind: "visitor" }
  | { kind: "user"; id: string; email: string; role: Role; token: string };

export const isSignedIn = (v: Viewer): v is Extract<Viewer, { kind: "user" }> => v.kind === "user";
export const isAdmin = (v: Viewer): boolean => v.kind === "user" && v.role === "admin";
