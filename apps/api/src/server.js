import { loadConfig } from "./config/env.js";
import { createContainer } from "./container.js";
import { createApp } from "./app.js";
let config;
try {
    config = loadConfig();
}
catch (e) {
    // A readable message, then exit. logger.fatal() right before exit can lose the line, so write directly.
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
}
const container = createContainer(config);
if (/^REPLACE|PLACEHOLDER/i.test(config.SUPABASE_SERVICE_ROLE_KEY)) {
    container.logger.warn("SUPABASE_SERVICE_ROLE_KEY is still a placeholder. Rate-limited routes (submit, vote, bookmark, report, profile) will answer 503 until it is set in apps/api/.env.");
}
const server = createApp(container).listen(config.PORT, () => {
    container.logger.info({ port: config.PORT, env: config.NODE_ENV }, "PrepLens API listening");
});
const shutdown = (signal) => {
    container.logger.info({ signal }, "shutting down");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
