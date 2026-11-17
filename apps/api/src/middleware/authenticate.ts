import type { NextFunction, Request, Response } from "express";
import type { Container } from "../container.js";
import type { Viewer } from "../domain/viewer.js";
import { AuthenticationError, ForbiddenError } from "../domain/errors.js";
import type { Role } from "@preplens/shared";

declare module "express-serve-static-core" {
  interface Request {
    ctx: import("../context.js").RequestContext;
    valid: { params?: unknown; query?: unknown; body?: unknown };
  }
}

function bearer(req: Request): string | null {
  const h = req.header("authorization");
  if (!h) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(h);
  if (!m) throw new AuthenticationError("The Authorization header must be: Bearer <token>.");
  return m[1] ?? null;
}

/**
 * Resolves who is calling (ADR-22). Identity comes from the verified token; the role comes from the database
 * on every request. Nothing about identity is ever read from the body, query or custom headers.
 *
 * - optional: no token means a visitor. A token that is present but invalid is an error, never a silent downgrade.
 * - required: no token means 401.
 */
export function authenticate(c: Container, mode: "optional" | "required") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = bearer(req);
      let viewer: Viewer = { kind: "visitor" };
      if (token) {
        const { userId, email } = await c.verifier.verify(token);
        // Provisional viewer so we can read our own profile as ourselves (RLS), then fix the role.
        const provisional: Viewer = { kind: "user", id: userId, email, role: "student", token };
        const me = await c.servicesFor(provisional).me.getMe();
        viewer = { ...provisional, role: me.role };
      } else if (mode === "required") {
        throw new AuthenticationError("Sign in to continue.");
      }
      req.ctx = { requestId: String(res.locals.requestId), viewer, services: c.servicesFor(viewer) };
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const v = req.ctx.viewer;
    if (v.kind !== "user") return next(new AuthenticationError("Sign in to continue."));
    if (role === "admin" && v.role !== "admin") return next(new ForbiddenError("Admins only."));
    next();
  };
}
