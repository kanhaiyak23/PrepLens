import { createHash } from "node:crypto";
import { RateLimitedError } from "../domain/errors.js";
export function rateLimit(c, action, limit, windowSeconds) {
    return async (req, _res, next) => {
        try {
            const v = req.ctx.viewer;
            const key = v.kind === "user" ? `u:${v.id}` : `ip:${createHash("sha256").update(req.ip ?? "unknown").digest("hex").slice(0, 32)}`;
            const n = typeof limit === "number" ? limit : v.kind === "user" ? limit.user : limit.visitor;
            const ok = await c.limiter.consume(key, action, n, windowSeconds);
            if (!ok)
                throw new RateLimitedError("You are doing that too often. Please try again later.");
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
