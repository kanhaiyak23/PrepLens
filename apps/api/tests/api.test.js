import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { authenticate, requireRole } from "../src/middleware/authenticate.js";
import { rateLimit } from "../src/middleware/rateLimit.js";
import { requestContext } from "../src/middleware/requestContext.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { FakeExperienceReader, FakeLimiter, card, makeContainer, USERS } from "./fakes.js";
describe("platform", () => {
    it("answers /healthz", async () => {
        const res = await request(createApp(makeContainer().container)).get("/healthz");
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ok");
    });
    it("returns the error envelope with a request id for unknown routes", async () => {
        const res = await request(createApp(makeContainer().container)).get("/api/v1/nope");
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("NOT_FOUND");
        expect(res.body.requestId).toBe(res.headers["x-request-id"]);
    });
    it("keeps a well-formed inbound request id and replaces a malformed one", async () => {
        const app = createApp(makeContainer().container);
        const good = await request(app).get("/healthz").set("x-request-id", "trace-12345678");
        expect(good.headers["x-request-id"]).toBe("trace-12345678");
        const bad = await request(app).get("/healthz").set("x-request-id", "x y<script>");
        expect(bad.headers["x-request-id"]).not.toContain("<");
    });
    it("returns a 400 envelope for malformed JSON", async () => {
        const res = await request(createApp(makeContainer().container)).post("/api/v1/anything").set("content-type", "application/json").send("{bad");
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_FAILED");
    });
    it("allows only the configured web origin", async () => {
        const app = createApp(makeContainer().container);
        const ok = await request(app).get("/healthz").set("Origin", "http://localhost:3100");
        expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:3100");
        const other = await request(app).get("/healthz").set("Origin", "https://evil.example");
        expect(other.headers["access-control-allow-origin"]).toBeUndefined();
    });
});
describe("GET /experiences", () => {
    const cards = Array.from({ length: 5 }, (_, i) => card(i + 1));
    it("paginates with a cursor and never repeats or skips a row", async () => {
        const { container } = makeContainer({ reader: new FakeExperienceReader(cards) });
        const app = createApp(container);
        const p1 = await request(app).get("/api/v1/experiences?limit=2");
        expect(p1.body.data.map((c) => c.id)).toEqual([cards[0].id, cards[1].id]);
        expect(p1.body.page.hasMore).toBe(true);
        const p2 = await request(app).get(`/api/v1/experiences?limit=2&cursor=${p1.body.page.nextCursor}`);
        expect(p2.body.data.map((c) => c.id)).toEqual([cards[2].id, cards[3].id]);
        const p3 = await request(app).get(`/api/v1/experiences?limit=2&cursor=${p2.body.page.nextCursor}`);
        expect(p3.body.data).toHaveLength(1);
        expect(p3.body.page).toEqual({ hasMore: false, nextCursor: null });
    });
    it("asks the reader for one extra row to detect hasMore", async () => {
        const reader = new FakeExperienceReader(cards);
        await request(createApp(makeContainer({ reader }).container)).get("/api/v1/experiences?limit=3");
        expect(reader.calls[0].limit).toBe(4);
    });
    it("rejects a tampered cursor and out-of-range filters with field errors", async () => {
        const app = createApp(makeContainer().container);
        const bad = await request(app).get("/api/v1/experiences?cursor=not-a-cursor");
        expect(bad.status).toBe(400);
        expect(bad.body.error.fields.cursor).toBeDefined();
        const big = await request(app).get("/api/v1/experiences?limit=500&outcome=maybe");
        expect(big.status).toBe(400);
        expect(Object.keys(big.body.error.fields)).toEqual(expect.arrayContaining(["limit", "outcome"]));
    });
    it("is publicly cacheable and identical for every caller", async () => {
        const res = await request(createApp(makeContainer({ reader: new FakeExperienceReader(cards) }).container)).get("/api/v1/experiences");
        expect(res.headers["cache-control"]).toContain("public");
        expect(JSON.stringify(res.body)).not.toContain("branch");
    });
});
describe("GET /experiences/:id", () => {
    const id = "00000000-0000-4000-8000-000000000099";
    const detail = { ...card(99), rounds: [], author: { anonymous: true, batch: 2027 } };
    it("404s for an unknown or hidden post without saying which", async () => {
        const res = await request(createApp(makeContainer().container)).get(`/api/v1/experiences/${id}`);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("NOT_FOUND");
    });
    it("400s for a non-uuid id", async () => {
        const res = await request(createApp(makeContainer().container)).get("/api/v1/experiences/123");
        expect(res.status).toBe(400);
    });
    it("is public for visitors and private for signed-in callers", async () => {
        const reader = new FakeExperienceReader([], new Map([[id, detail]]));
        const app = createApp(makeContainer({ reader }).container);
        const anon = await request(app).get(`/api/v1/experiences/${id}`);
        expect(anon.status).toBe(200);
        expect(anon.headers["cache-control"]).toContain("public");
        expect(anon.headers["vary"]).toContain("Authorization");
        const signed = await request(app).get(`/api/v1/experiences/${id}`).set("Authorization", "Bearer tok-student");
        expect(signed.headers["cache-control"]).toBe("private, no-store");
    });
});
describe("authentication", () => {
    const app = () => createApp(makeContainer().container);
    it("401s without a token", async () => {
        const res = await request(app()).get("/api/v1/me");
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe("UNAUTHENTICATED");
    });
    it("401s for an invalid token and for a malformed header, never silently treating them as a visitor", async () => {
        expect((await request(app()).get("/api/v1/me").set("Authorization", "Bearer nope")).status).toBe(401);
        expect((await request(app()).get("/api/v1/me").set("Authorization", "Token abc")).status).toBe(401);
        expect((await request(app()).get("/api/v1/experiences").set("Authorization", "Bearer nope")).status).toBe(401);
    });
    it("returns the profile for a valid token", async () => {
        const res = await request(app()).get("/api/v1/me").set("Authorization", "Bearer tok-student");
        expect(res.status).toBe(200);
        expect(res.body.data.email).toBe(USERS["tok-student"].email);
        expect(res.headers["cache-control"]).toBe("private, no-store");
    });
    it("ignores any identity or role supplied by the client", async () => {
        const res = await request(app())
            .get(`/api/v1/me?userId=${USERS["tok-admin"].userId}&role=admin`)
            .set("Authorization", "Bearer tok-student")
            .set("x-user-id", USERS["tok-admin"].userId)
            .set("x-role", "admin");
        expect(res.body.data.role).toBe("student");
        expect(res.body.data.id).toBe(USERS["tok-student"].userId);
    });
});
describe("role and rate-limit middleware", () => {
    function mini(limiter = new FakeLimiter()) {
        const { container } = makeContainer({ limiter });
        const a = express();
        a.use(requestContext(container.logger));
        a.get("/admin", authenticate(container, "required"), requireRole("admin"), (_q, r) => void r.json({ ok: true }));
        a.get("/limited", authenticate(container, "optional"), rateLimit(container, "test", 1, 60), (_q, r) => void r.json({ ok: true }));
        a.use(errorHandler(container.logger));
        return { app: a, limiter };
    }
    it("lets admins in and keeps students out", async () => {
        const { app } = mini();
        expect((await request(app).get("/admin").set("Authorization", "Bearer tok-admin")).status).toBe(200);
        const s = await request(app).get("/admin").set("Authorization", "Bearer tok-student");
        expect(s.status).toBe(403);
        expect(s.body.error.code).toBe("FORBIDDEN");
    });
    it("returns 429 when the limiter denies, keyed on the user and never the raw IP", async () => {
        const { app, limiter } = mini(new FakeLimiter(0));
        const res = await request(app).get("/limited").set("Authorization", "Bearer tok-student");
        expect(res.status).toBe(429);
        expect(res.body.error.code).toBe("RATE_LIMITED");
        expect(limiter.keys[0]).toBe(`u:${USERS["tok-student"].userId}`);
        await request(app).get("/limited");
        expect(limiter.keys[1]).toMatch(/^ip:[0-9a-f]{32}$/);
    });
});
