/**
 * middleware/rateLimit.ts — "NOT TOO OFTEN": LIMITS HOW MANY TIMES SOMEONE CAN DO SOMETHING
 *
 * What it does: before an action (post, vote, report...), counts how many times this person did it in the time window.
 * Over the limit -> 429 "You are doing that too often."
 *
 * System design:
 * - Rate limiting against spam and abuse (ADR-11), e.g. 5 posts a day, 60 votes a minute.
 * - Keyed on the USER, not the IP: the whole campus shares one Wi-Fi IP, so limiting by IP would block everyone at once.
 * - Signed-out visitors are limited by IP, but the IP is hashed (SHA-256) first, so real IP addresses are never stored (privacy).
 * - The counting itself lives behind the RateLimiter interface (stored in Postgres, see PostgresRateLimiter.ts),
 *   so limits keep working across server restarts and multiple servers.
 */
import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Container } from "../container.js";
import { RateLimitedError } from "../domain/errors.js";

/** One number for everyone, or different numbers for signed-in users and visitors. */
export type Limit = number | { user: number; visitor: number };

/** rateLimit(c, "submit", 5, 86400) = "at most 5 submits per 86,400 seconds (one day)". */
export function rateLimit(c: Container, action: string, limit: Limit, windowSeconds: number) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const v = req.ctx.viewer;
      // Who are we counting? A signed-in user by id; a visitor by a hash of their IP.
      const key = v.kind === "user" ? `u:${v.id}` : `ip:${createHash("sha256").update(req.ip ?? "unknown").digest("hex").slice(0, 32)}`;
      const n = typeof limit === "number" ? limit : v.kind === "user" ? limit.user : limit.visitor;
      // Add one to the count; returns false if this would go over the limit.
      const ok = await c.limiter.consume(key, action, n, windowSeconds);
      if (!ok) throw new RateLimitedError("You are doing that too often. Please try again later.");
      next();
    } catch (err) {
      next(err);
    }
  };
}
