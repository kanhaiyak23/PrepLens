import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Container } from "../container.js";
import { RateLimitedError } from "../domain/errors.js";

/**
 * Keyed on the user for signed-in actions, not the IP: a whole campus shares one NAT address (ADR-11).
 * Signed-out readers fall back to a hash of the IP so raw addresses are not stored.
 */
export type Limit = number | { user: number; visitor: number };

export function rateLimit(c: Container, action: string, limit: Limit, windowSeconds: number) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const v = req.ctx.viewer;
      const key = v.kind === "user" ? `u:${v.id}` : `ip:${createHash("sha256").update(req.ip ?? "unknown").digest("hex").slice(0, 32)}`;
      const n = typeof limit === "number" ? limit : v.kind === "user" ? limit.user : limit.visitor;
      const ok = await c.limiter.consume(key, action, n, windowSeconds);
      if (!ok) throw new RateLimitedError("You are doing that too often. Please try again later.");
      next();
    } catch (err) {
      next(err);
    }
  };
}
