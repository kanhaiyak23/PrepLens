/**
 * middleware/authenticate.ts — WHO IS CALLING, AND ARE THEY ALLOWED?
 *
 * What it does:
 *   - authenticate(): reads the login token from the "Authorization: Bearer <token>" header, asks Supabase if it is real,
 *     then reads the person's role (student or admin) from the database. The result is the "viewer".
 *   - requireRole("admin"): lets only admins through; everyone else gets 403 Forbidden.
 *
 * System design:
 * - Stateless token authentication (ADR-22): the server keeps no sessions. Each request proves who it is with a token,
 *   so any copy of the API can answer any request (easy to scale horizontally).
 * - Zero trust in the client: identity comes ONLY from the verified token, and the role ONLY from the database.
 *   Nothing the browser sends in the body or other headers can make someone an admin.
 * - Role-Based Access Control (RBAC): permissions depend on the role (student / admin).
 * - Fresh role on every request: if an admin's access is removed, it takes effect on their very next request.
 * - 401 vs 403: 401 = "we don't know who you are, sign in"; 403 = "we know who you are, but you're not allowed".
 */
import type { NextFunction, Request, Response } from "express";
import type { Container } from "../container.js";
import type { Viewer } from "../domain/viewer.js";
import { AuthenticationError, ForbiddenError } from "../domain/errors.js";
import type { Role } from "@preplens/shared";

// Tell TypeScript that every Express request carries our context (req.ctx) and validated input (req.valid).
declare module "express-serve-static-core" {
  interface Request {
    ctx: import("../context.js").RequestContext;
    valid: { params?: unknown; query?: unknown; body?: unknown };
  }
}

/** Pulls the token out of "Authorization: Bearer <token>". No header -> null. A badly formed header -> 401. */
function bearer(req: Request): string | null {
  const h = req.header("authorization");
  if (!h) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(h);
  if (!m) throw new AuthenticationError("The Authorization header must be: Bearer <token>.");
  return m[1] ?? null;
}

/**
 * Works out who is calling and attaches it to the request (req.ctx).
 * - "optional" mode (public pages): no token = visitor. But a token that is present and INVALID is an error,
 *   never quietly treated as a visitor (so bugs and attacks are visible).
 * - "required" mode (signed-in pages): no token = 401 "Sign in to continue".
 */
export function authenticate(c: Container, mode: "optional" | "required") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = bearer(req);
      let viewer: Viewer = { kind: "visitor" };
      if (token) {
        // 1. Is the token real? Supabase answers with the user's id and email.
        const { userId, email } = await c.verifier.verify(token);
        // 2. Read this user's profile AS this user (so database security rules apply) to get their real role.
        //    We start with "student" as a safe placeholder, then replace it with the role from the database.
        const provisional: Viewer = { kind: "user", id: userId, email, role: "student", token };
        const me = await c.servicesFor(provisional).me.getMe();
        viewer = { ...provisional, role: me.role };
      } else if (mode === "required") {
        throw new AuthenticationError("Sign in to continue.");
      }
      // 3. Attach the request id, the viewer and their services, for the controller to use.
      req.ctx = { requestId: String(res.locals.requestId), viewer, services: c.servicesFor(viewer) };
      next();
    } catch (err) {
      next(err); // hand any error to the central error handler
    }
  };
}

/** Role check (RBAC). Not signed in -> 401. Signed in but not an admin -> 403 "Admins only." */
export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const v = req.ctx.viewer;
    if (v.kind !== "user") return next(new AuthenticationError("Sign in to continue."));
    if (role === "admin" && v.role !== "admin") return next(new ForbiddenError("Admins only."));
    next();
  };
}
