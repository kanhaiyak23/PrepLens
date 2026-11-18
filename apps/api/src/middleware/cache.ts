/**
 * middleware/cache.ts — WHAT MAY BE CACHED, AND FOR HOW LONG
 *
 * What it does: sets the Cache-Control header, which tells browsers and CDNs whether they may keep a copy of the answer.
 *
 * System design:
 * - HTTP caching (ADR-09): public answers (the feed, the company list) are the same for everyone, so a CDN can keep
 *   them for a short time. That makes pages faster and takes load off the server and database.
 * - Stale-while-revalidate: after the cache time, a slightly old copy can still be served instantly while a fresh one
 *   is fetched in the background.
 * - Privacy: anything that depends on WHO is asking (my profile, admin data) is "private, no-store" — never cached,
 *   so one person's data can never be served to someone else.
 */
import type { NextFunction, Request, Response } from "express";

/** Public answer, same for everyone: shared caches may keep it for `sMaxAge` seconds (default 60). */
export const publicCache = (sMaxAge = 60, swr = 300) => (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Cache-Control", `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`);
  next();
};

/** Private answer: never store a copy anywhere. Used for every signed-in and admin route. */
export const noStore = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
};

/**
 * For one post: a visitor sees the public version (cacheable), but the author or an admin may see a hidden post
 * (never cached). "Vary: Authorization" tells caches that the answer depends on the login header.
 */
export const cacheUnlessSignedIn = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Vary", "Authorization");
  res.setHeader("Cache-Control", req.header("authorization") ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=300");
  next();
};
