/**
 * app.ts — BUILDS THE EXPRESS APPLICATION
 *
 * What it does: creates the Express app and plugs in, in order:
 *   1. a request id for every request (tracing),
 *   2. security headers (helmet),
 *   3. CORS: only our own website may call this API from a browser,
 *   4. JSON body reading (max 100 KB, so nobody can send a huge body),
 *   5. a health check URL,
 *   6. all the real routes under /api/v1,
 *   7. a "route not found" handler and the one central error handler.
 *
 * System design:
 * - Separation of concerns: this file BUILDS the app but does not START it (server.ts does).
 *   That lets the tests import the app and send fake requests without opening a port.
 * - API versioning: every route lives under /api/v1, so a future /api/v2 can change things
 *   without breaking the website that still uses v1.
 * - Security by default: strict CORS (one origin, never "*"), helmet headers, a body size limit.
 */
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import type { Container } from "./container.js";
import { requestContext } from "./middleware/requestContext.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { v1Router } from "./routes/index.js";

export function createApp(c: Container): Express {
  const app = express();
  app.disable("x-powered-by"); // don't advertise that we run Express (less information for attackers)
  if (c.config.NODE_ENV === "production") app.set("trust proxy", 1); // Render sits in front of us; trust its one proxy hop

  app.use(requestContext(c.logger)); // gives each request an id and logs it
  app.use(helmet());                 // standard security headers
  // CORS: the browser may call us only from our website's exact address. We use Bearer tokens, not cookies (ADR-22),
  // so no "credentials" mode is needed. Never "*" (that would let any website call the API from a user's browser).
  app.use(cors({ origin: (origin, cb) => cb(null, origin === c.config.FRONTEND_URL), methods: ["GET", "POST", "PUT", "PATCH", "DELETE"], allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key", "X-Request-Id"], exposedHeaders: ["X-Request-Id"], maxAge: 600 }));
  app.use(express.json({ limit: "100kb" })); // read JSON bodies, refuse anything over 100 KB

  // Health check: the hosting platform calls this to see if the server is alive. Never cached.
  app.get("/healthz", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "ok", uptime: Math.round(process.uptime()), env: c.config.NODE_ENV });
  });
  app.use("/api/v1", v1Router(c)); // every real endpoint (see routes/index.ts)

  app.use(notFound);                // unknown URL -> 404 in our standard error format
  app.use(errorHandler(c.logger));  // any error anywhere -> one standard error response
  return app;
}
