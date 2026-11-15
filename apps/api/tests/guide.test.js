import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { CompanyGuide, buildPrompt, computeStats, fingerprintOf, groundContent } from "../src/domain/guide/CompanyGuide.js";
import { GeminiClient, LlmHttpError } from "../src/infrastructure/llm/GeminiClient.js";
import { FallbackLlmClient } from "../src/infrastructure/llm/FallbackLlmClient.js";
import { UpstreamError } from "../src/domain/errors.js";
import { FakeGuideRepo, FakeLimiter, FakeLlm, FakeWorld, makeContainer, source, sourcesOf } from "./fakes.js";
const good = () => ({
    overview: "An assessment and a technical round.",
    rounds: [{ name: "Technical", focus: "Linked lists and arrays.", sources: [1, 2, 99] }, { name: "Invented", focus: "Nothing real", sources: [42] }],
    tips: [{ text: "Say tests first.", sources: [3] }, { text: "Uncited tip", sources: [] }],
});
const setup = (o) => { const m = makeContainer(o); return { ...m, app: createApp(m.container) }; };
const url = "/api/v1/companies/example-co/guide";
describe("GET /companies/:slug/guide", () => {
    it("generates, grounds and caches; the second call does not touch the model", async () => {
        const llm = new FakeLlm(good);
        const { app, guides } = setup({ llm });
        const first = await request(app).get(url);
        expect(first.status).toBe(200);
        const g = first.body.data;
        expect(g.rounds).toEqual([{ name: "Technical", focus: "Linked lists and arrays.", sources: [1, 2] }]); // 99 dropped, "Invented" dropped
        expect(g.tips).toEqual([{ text: "Say tests first.", sources: [3] }]); // uncited tip dropped
        expect(g.stale).toBe(false);
        expect(g.sources).toHaveLength(3);
        expect(g.stats.experienceCount).toBe(3);
        expect(guides.saved).toHaveLength(1);
        await request(app).get(url);
        expect(llm.calls).toHaveLength(1);
    });
    it("is publicly cacheable and does not leak authors beyond what is public", async () => {
        const { app } = setup({ llm: new FakeLlm(good) });
        const res = await request(app).get(url);
        expect(res.headers["cache-control"]).toContain("public");
        for (const src of res.body.data.sources)
            expect(Object.keys(src.author).sort()).toEqual(["anonymous", "batch"]);
        expect(JSON.stringify(res.body)).not.toContain("branch");
    });
    it("409s when there are too few experiences, 404s for an unknown company", async () => {
        const w = new FakeWorld();
        w.sources = sourcesOf(2);
        const res = await request(setup({ llm: new FakeLlm(good), world: w }).app).get(url);
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("NOT_ENOUGH_DATA");
        const none = new FakeWorld();
        none.sources = null;
        expect((await request(setup({ llm: new FakeLlm(good), world: none }).app).get(url)).status).toBe(404);
    });
    it("answers 503 (not 500) when no model is configured and nothing is cached", async () => {
        const res = await request(setup({ llm: null }).app).get(url);
        expect(res.status).toBe(503);
        expect(res.body.error.code).toBe("UPSTREAM_UNAVAILABLE");
    });
    it("refuses a model answer of the wrong shape or with nothing groundable, and caches nothing", async () => {
        const bad = setup({ llm: new FakeLlm(() => ({ nope: true })) });
        expect((await request(bad.app).get(url)).status).toBe(503);
        expect(bad.guides.saved).toHaveLength(0);
        const ungrounded = setup({ llm: new FakeLlm(() => ({ overview: "x", rounds: [{ name: "a", focus: "b", sources: [50] }], tips: [] })) });
        expect((await request(ungrounded.app).get(url)).status).toBe(503);
    });
    it("limits signed-out readers separately from signed-in users (keyed on user or hashed IP)", async () => {
        const limiter = new FakeLimiter(0);
        const { app } = setup({ llm: new FakeLlm(good), limiter });
        expect((await request(app).get(url)).status).toBe(429);
        expect(limiter.keys[0]).toMatch(/^ip:/);
    });
    it("rejects a malformed slug", async () => {
        expect((await request(setup({ llm: null }).app).get("/api/v1/companies/Bad Slug!/guide")).status).toBe(400);
    });
});
describe("staleness and retraction", () => {
    async function primed() {
        const llm = new FakeLlm(good);
        const w = new FakeWorld();
        const m = setup({ llm, world: w });
        await request(m.app).get(url); // cache a guide for 3 sources
        return { ...m, llm, w };
    }
    it("regenerates when a post changes (fingerprint)", async () => {
        const { app, w, llm } = await primed();
        w.sources = { ...w.sources, experiences: w.sources.experiences.map((e, i) => (i === 0 ? { ...e, updatedAt: "2026-07-01T00:00:00.000Z" } : e)) };
        await request(app).get(url);
        expect(llm.calls).toHaveLength(2);
    });
    it("if the model fails, a stale guide is shown only while everything it cites is still published", async () => {
        const { app, w, llm } = await primed();
        llm.reply = () => { throw new LlmHttpError(503, "busy"); };
        // a NEW post appears (fingerprint changes) but all cited posts remain: stale guide is acceptable
        w.sources = { ...w.sources, experiences: [...w.sources.experiences, source(4)] };
        const stale = await request(app).get(url);
        expect(stale.status).toBe(200);
        expect(stale.body.data.stale).toBe(true);
        // a CITED post is withdrawn: the old guide must not be shown
        w.sources = { ...w.sources, experiences: w.sources.experiences.filter((e) => e.id !== sourcesOf(3).experiences[0].id) };
        const gone = await request(app).get(url);
        expect(gone.status).toBe(503);
    });
});
describe("domain functions", () => {
    it("fingerprint is order-independent and changes with any update", () => {
        const a = sourcesOf(3).experiences;
        expect(fingerprintOf(a)).toBe(fingerprintOf([...a].reverse()));
        expect(fingerprintOf(a)).not.toBe(fingerprintOf(a.map((e, i) => (i ? e : { ...e, updatedAt: "2027-01-01T00:00:00Z" }))));
    });
    it("computes stats in code from the posts", () => {
        const s = computeStats(sourcesOf(3).experiences);
        expect(s.experienceCount).toBe(3);
        expect(s.outcomes).toEqual({ selected: 2, rejected: 1 });
        expect(s.topTopics[0]).toEqual({ name: "Linked lists", count: 2 });
    });
    it("numbers sources in the prompt and groundContent keeps only real citations", () => {
        expect(buildPrompt("Example Co", sourcesOf(2).experiences).prompt).toContain("[2]");
        const out = groundContent({ overview: "o", rounds: [{ name: "r", focus: "f", sources: [1, 1, 9, 0, 2] }], tips: [] }, 2);
        expect(out.rounds[0].sources).toEqual([1, 2]);
    });
    it("CompanyGuide.isStale and citesOnly express the two freshness rules", () => {
        const g = new CompanyGuide("c", "fp", { overview: "o", rounds: [], tips: [] }, ["a", "b"], [], { experienceCount: 2, outcomes: {}, topTopics: [] }, "m", new Date());
        expect(g.isStale("fp")).toBe(false);
        expect(g.isStale("other")).toBe(true);
        expect(g.citesOnly(new Set(["a", "b", "c"]))).toBe(true);
        expect(g.citesOnly(new Set(["a"]))).toBe(false);
    });
});
describe("LLM adapter and decorator", () => {
    const req = { system: "s", prompt: "p", schema: {} };
    const reply = (status, body) => (async () => new Response(JSON.stringify(body), { status }));
    it("GeminiClient puts the key in a header, not the URL, and parses structured output", async () => {
        let seen;
        const f = (async (u, init) => { seen = { url: u, headers: init.headers }; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] })); });
        const out = await new GeminiClient("SECRET-KEY", "m1", f).generateJson(req);
        expect(out).toEqual({ data: { a: 1 }, model: "m1" });
        expect(seen.url).not.toContain("SECRET-KEY");
        expect(seen.headers["x-goog-api-key"]).toBe("SECRET-KEY");
    });
    it("maps vendor errors and malformed JSON to typed upstream errors", async () => {
        await expect(new GeminiClient("k", "m", reply(429, { error: { message: "quota" } })).generateJson(req)).rejects.toMatchObject({ status: 429 });
        // vendor wording (keys, quotas) is kept for the logs and never becomes the client-facing message
        const leaked = await new GeminiClient("k", "m", reply(400, { error: { message: "API key not valid. Please pass a valid API key." } })).generateJson(req).catch((e) => e);
        expect(leaked.message).toBe("The AI guide is temporarily unavailable.");
        expect(leaked.detail).toContain("API key not valid");
        await expect(new GeminiClient("k", "m", reply(200, { candidates: [{ content: { parts: [{ text: "not json" }] } }] })).generateJson(req)).rejects.toMatchObject({ status: 502 });
    });
    it("FallbackLlmClient moves past a transient failure, but not past a rejected request", async () => {
        const ok = { generateJson: async () => ({ data: { ok: true }, model: "second" }) };
        const busy = { generateJson: async () => { throw new LlmHttpError(503, "busy"); } };
        const bad = { generateJson: async () => { throw new LlmHttpError(400, "bad request"); } };
        expect((await new FallbackLlmClient([busy, ok]).generateJson(req)).model).toBe("second");
        await expect(new FallbackLlmClient([bad, ok]).generateJson(req)).rejects.toMatchObject({ status: 400 });
        const retired = { generateJson: async () => { throw new LlmHttpError(404, "model not found"); } };
        expect((await new FallbackLlmClient([retired, ok]).generateJson(req)).model).toBe("second"); // a retired model id must not take the guide down
        await expect(new FallbackLlmClient([busy, busy]).generateJson(req)).rejects.toBeInstanceOf(UpstreamError);
    });
});
describe("company admin", () => {
    const A = { Authorization: "Bearer tok-admin" }, S = { Authorization: "Bearer tok-student" };
    it("is admin-only, approves, and merges only with a target", async () => {
        const { app, world } = setup({});
        expect((await request(app).get("/api/v1/admin/companies/pending").set(S)).status).toBe(403);
        expect((await request(app).get("/api/v1/admin/companies/pending").set(A)).body.data[0].slug).toBe("googel");
        expect((await request(app).post("/api/v1/admin/companies/googel/merge").set(A).send({})).status).toBe(400);
        const ok = await request(app).post("/api/v1/admin/companies/googel/merge").set(A).send({ mergeInto: "google" });
        expect(ok.body.data.result).toBe("merged");
        expect(world.companyDecisions[0]).toEqual({ slug: "googel", action: "merge", mergeInto: "google" });
        expect((await request(app).post("/api/v1/admin/companies/googel/approve").set(A)).status).toBe(409);
        expect((await request(app).post("/api/v1/admin/companies/googel/delete").set(A)).status).toBe(400);
    });
});
void FakeGuideRepo;
