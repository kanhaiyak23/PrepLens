import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import type { Container } from "./container.js";
import { requestContext } from "./middleware/requestContext.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { v1Router } from "./routes/index.js";

/** Built separately from server.ts so tests can import the app without opening a port. */
export function createApp(c: Container): Express {
  const app = express();
  app.disable("x-powered-by");
  if (c.config.NODE_ENV === "production") app.set("trust proxy", 1);

  app.use(requestContext(c.logger));
  app.use(helmet());
  // Bearer tokens, not cookies (ADR-22): no credentials mode, one explicit origin, never "*".
  app.use(cors({ origin: (origin, cb) => cb(null, origin === c.config.FRONTEND_URL), methods: ["GET", "POST", "PUT", "PATCH", "DELETE"], allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key", "X-Request-Id"], exposedHeaders: ["X-Request-Id"], maxAge: 600 }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/healthz", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "ok", uptime: Math.round(process.uptime()), env: c.config.NODE_ENV });
  });
  app.use("/api/v1", v1Router(c));

  app.use(notFound);
  app.use(errorHandler(c.logger));
  return app;
}
