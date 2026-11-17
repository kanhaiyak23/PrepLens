import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { ExperienceDetail } from "@preplens/shared";
import { createApp } from "../src/app.js";
import { AnonymousAuthor, AuthorVisibilityFactory, NamedAuthor } from "../src/domain/model/AuthorVisibility.js";
import { ExperienceLifecycle, TRANSITIONS } from "../src/domain/model/ExperienceLifecycle.js";
import { FeedSorts, InterviewDateFirst, NewestFirst } from "../src/domain/model/FeedSort.js";
import { ValidationError } from "../src/domain/errors.js";
import { FakeExperienceReader, FakeWorld, EXP, card, makeContainer } from "./fakes.js";

const S = { Authorization: "Bearer tok-student" };
const A = { Authorization: "Bearer tok-admin" };
const here = dirname(fileURLToPath(import.meta.url));

describe("FeedSort strategy", () => {
  const c = card(1, { interviewYear: 2026, interviewMonth: 3 });

  it("each ordering builds a cursor and resumes from it", () => {
    const n = new NewestFirst();
    expect(n.after(n.nextCursor(c))).toEqual({ kind: "newest", createdAt: c.createdAt, id: c.id });
    const i = new InterviewDateFirst();
    expect(i.after(i.nextCursor(c))).toEqual({ kind: "interview", year: 2026, month: 3, id: c.id });
  });

  it("a post with no month resumes as month 0, matching the SQL ordering", () => {
    const i = new InterviewDateFirst();
    expect(i.after(i.nextCursor(card(2, { interviewMonth: null })))).toMatchObject({ year: 2026, month: 0 });
  });

  it("a cursor from one ordering is refused under another, and tampering is refused", () => {
    const fromNewest = new NewestFirst().nextCursor(c);
    expect(() => new InterviewDateFirst().after(fromNewest)).toThrow(ValidationError);
    expect(() => new NewestFirst().after("garbage")).toThrow(ValidationError);
    const forged = Buffer.from(JSON.stringify({ s: "interview", k: "20x6.3", i: c.id })).toString("base64url");
    expect(() => new InterviewDateFirst().after(forged)).toThrow(ValidationError);
  });

  it("the factory picks the strategy by name", () => {
    expect(FeedSorts.create("interview")).toBeInstanceOf(InterviewDateFirst);
    expect(FeedSorts.create("newest")).toBeInstanceOf(NewestFirst);
  });

  it("GET /experiences?sort=interview passes the sort and a matching resume point to the reader", async () => {
    const cards = Array.from({ length: 4 }, (_, i) => card(i + 1, { interviewYear: 2026, interviewMonth: 4 - i }));
    const reader = new FakeExperienceReader(cards);
    const { container } = makeContainer({ reader });
    const app = createApp(container);
    const p1 = await request(app).get("/api/v1/experiences?sort=interview&limit=2");
    expect(reader.calls[0]).toMatchObject({ sort: "interview", limit: 3 });
    await request(app).get(`/api/v1/experiences?sort=interview&limit=2&cursor=${p1.body.page.nextCursor}`);
    expect(reader.calls[1]!.after).toMatchObject({ kind: "interview", year: 2026, month: 3 });
  });

  it("rejects an unknown sort and a cursor that belongs to another sort", async () => {
    const reader = new FakeExperienceReader(Array.from({ length: 3 }, (_, i) => card(i + 1)));
    const app = createApp(makeContainer({ reader }).container);
    expect((await request(app).get("/api/v1/experiences?sort=random")).status).toBe(400);
    const p1 = await request(app).get("/api/v1/experiences?limit=1");
    const crossed = await request(app).get(`/api/v1/experiences?sort=interview&cursor=${p1.body.page.nextCursor}`);
    expect(crossed.status).toBe(400);
    expect(crossed.body.error.fields.cursor).toBeDefined();
  });
});

describe("AuthorVisibility polymorphism", () => {
  it("an anonymous author can only serialise to anonymous + batch, whatever else arrives", () => {
    const a = AuthorVisibilityFactory.fromDb({ anonymous: true, batch: 2027, name: "Asha", branch: "CSE", id: "u1", email: "a@b.c" });
    expect(a).toBeInstanceOf(AnonymousAuthor);
    expect(a.toPublic()).toEqual({ anonymous: true, batch: 2027 });
  });
  it("fails closed: a missing or odd flag is anonymous", () => {
    for (const raw of [null, undefined, {}, { anonymous: "no", name: "X" }, { name: "X", batch: 2026 }]) {
      expect(AuthorVisibilityFactory.fromDb(raw)).toBeInstanceOf(AnonymousAuthor);
    }
  });
  it("only an explicit anonymous:false is named", () => {
    const n = AuthorVisibilityFactory.fromDb({ anonymous: false, name: "Maya", batch: 2026, branch: "ECE" });
    expect(n).toBeInstanceOf(NamedAuthor);
    expect(n.toPublic()).toEqual({ anonymous: false, name: "Maya", batch: 2026, branch: "ECE" });
  });
});

describe("ExperienceLifecycle state machine", () => {
  const ctx = (o: Partial<Parameters<typeof ExperienceLifecycle.actionsFor>[0]>) => ({ status: "published" as const, isOwner: false, isAdmin: false, hasPendingUpdate: false, ...o });

  it("author actions follow the status", () => {
    expect(ExperienceLifecycle.actionsFor(ctx({ isOwner: true }))).toEqual(["edit", "withdraw"]);
    expect(ExperienceLifecycle.actionsFor(ctx({ isOwner: true, status: "unpublished" }))).toEqual(["edit", "republish"]);
    expect(ExperienceLifecycle.actionsFor(ctx({ isOwner: true, status: "rejected" }))).toEqual(["edit"]);
    expect(ExperienceLifecycle.actionsFor(ctx({ isOwner: true, status: "removed" }))).toEqual([]);
    expect(ExperienceLifecycle.actionsFor(ctx({ isOwner: true, hasPendingUpdate: true }))).toContain("cancel-update");
  });
  it("admin actions follow the status, and a stranger gets nothing", () => {
    expect(ExperienceLifecycle.actionsFor(ctx({ isAdmin: true, status: "pending" }))).toEqual(["approve", "reject"]);
    expect(ExperienceLifecycle.actionsFor(ctx({ isAdmin: true }))).toEqual(["remove"]);
    expect(ExperienceLifecycle.actionsFor(ctx({ isAdmin: true, status: "removed" }))).toEqual(["reinstate"]);
    expect(ExperienceLifecycle.actionsFor(ctx({}))).toEqual([]);
  });
  it("every action it offers is a legal move or an edit", () => {
    expect(ExperienceLifecycle.canMove("pending", "published")).toBe(true);
    expect(ExperienceLifecycle.canMove("published", "pending")).toBe(false);
    expect(ExperienceLifecycle.canMove("removed", "published")).toBe(false);
    expect(ExperienceLifecycle.canMove("published", "published")).toBe(true);
  });

  it("TRANSITIONS equals the transition table in the database trigger (no silent drift)", () => {
    const sql = readFileSync(resolve(here, "../../../supabase/migrations/0006_guard_ignores_search_index.sql"), "utf8");
    const block = /legal := \(old\.status, new\.status\) in \(([\s\S]*?)\);/.exec(sql)?.[1] ?? "";
    const fromSql = [...block.matchAll(/\('(\w+)','(\w+)'\)/g)].map((m) => `${m[1]}>${m[2]}`).sort();
    const fromTs = TRANSITIONS.map(([f, t]) => `${f}>${t}`).sort();
    expect(fromSql.length).toBeGreaterThan(0);
    expect(fromTs).toEqual(fromSql);
  });

  it("the experience detail tells the owner and an admin what they may do, and tells a visitor nothing extra", async () => {
    const base = { ...card(50), rounds: [] } as unknown as ExperienceDetail;
    const owner = { ...base, status: "published", isOwner: true, pendingUpdate: { outcome: "selected" } } as ExperienceDetail;
    const w = new FakeWorld();
    const reader = new FakeExperienceReader([], new Map([[EXP, owner]]));
    const app = createApp(makeContainer({ reader, world: w }).container);
    expect((await request(app).get(`/api/v1/experiences/${EXP}`).set(S)).body.data.allowedActions).toEqual(["edit", "withdraw", "cancel-update"]);
    const adminView = { ...base, status: "pending", isOwner: false } as ExperienceDetail;
    const app2 = createApp(makeContainer({ reader: new FakeExperienceReader([], new Map([[EXP, adminView]])) }).container);
    expect((await request(app2).get(`/api/v1/experiences/${EXP}`).set(A)).body.data.allowedActions).toEqual(["approve", "reject"]);
    const app3 = createApp(makeContainer({ reader: new FakeExperienceReader([], new Map([[EXP, base]])) }).container);
    expect(await request(app3).get(`/api/v1/experiences/${EXP}`).then((r) => "allowedActions" in r.body.data)).toBe(false);
  });
});
