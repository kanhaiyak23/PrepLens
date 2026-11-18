/**
 * server.ts — THE "ON" SWITCH OF THE API
 *
 * What it does: reads the settings, builds the app, and starts listening on a port (4000 by default).
 * It is the only file that actually opens a network port.
 *
 * System design:
 * - Fail fast: if a setting is missing or wrong, the server refuses to start and prints why,
 *   instead of starting half-broken and failing later on a real user's request.
 * - Graceful shutdown: when the host (Render) stops the server, it finishes the requests already
 *   in progress before exiting, so no user gets a cut-off response.
 */
import { loadConfig } from "./config/env.js";
import { createContainer } from "./container.js";
import { createApp } from "./app.js";

// Step 1: read and check the settings from .env. Stop immediately if anything is wrong.
let config;
try {
  config = loadConfig();
} catch (e) {
  // Print a clear message and exit. We write straight to stderr so the message is never lost on exit.
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
}

// Step 2: build every object the API needs (services, database adapters, AI client). See container.ts.
const container = createContainer(config);
// Friendly warning: without the real service key, the rate limiter cannot work, so limited routes answer 503.
if (/^REPLACE|PLACEHOLDER/i.test(config.SUPABASE_SERVICE_ROLE_KEY)) {
  container.logger.warn("SUPABASE_SERVICE_ROLE_KEY is still a placeholder. Rate-limited routes (submit, vote, bookmark, report, profile) will answer 503 until it is set in apps/api/.env.");
}

// Step 3: start listening for requests.
const server = createApp(container).listen(config.PORT, () => {
  container.logger.info({ port: config.PORT, env: config.NODE_ENV }, "PrepLens API listening");
});

// Graceful shutdown: stop taking new requests, let current ones finish, then exit.
// If something hangs, force-exit after 10 seconds so the host is never stuck waiting.
const shutdown = (signal: string) => {
  container.logger.info({ signal }, "shutting down");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM")); // sent by the hosting platform on redeploy
process.on("SIGINT", () => shutdown("SIGINT"));   // sent when you press Ctrl+C locally
