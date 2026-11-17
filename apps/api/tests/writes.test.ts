import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { DetailedSubmission, QuickSubmission, SubmissionFactory } from "../src/domain/Submission.js";
import { ModerationCommandFactory } from "../src/domain/ModerationCommand.js";
import { ForbiddenError, ValidationError } from "../src/domain/errors.js";
import { ModerationService } from "../src/services/ModerationService.js";
import { EXP, FakeLimiter, FakeWorld, USERS, card, makeContainer } from "./fakes.js";
import type { SubmissionDto } from "@preplens/shared";

const S = { Authorization: "Bearer tok-student" };
const A = { Authorization: "Bearer tok-admin" };
const base = { company: "Example Co", role: "SDE", driveType: "on-campus", interviewYear: 2026, outcome: "selected", isAnonymous: true, consent: true };
const quick = { ...base, mode: "quick", freeText: "Two rounds. Linked lists in the second." };
const detailed = { ...base, mode: "detailed", rounds: [{ name: "Technical", tips: "Say tests first", questions: [{ text: "Reverse a list", topic: "Linked lists" }] }] };
const setup = (o: Parameters<typeof makeContainer>[0] = {}) => { const m = makeContainer(o); return { ...m, app: createApp(m.container) }; };

describe("POST /experiences", () => {
  it("needs a signed-in user", async () => {
    expect((await request(setup().app).post("/api/v1/experiences").send(quick)).status).toBe(401);
  });

  it("returns 201 pending and normalises a quick submission to one Overview round", async () => {
    const { app, world } = setup();
    const res = await request(app).post("/api/v1/experiences").set(S).send(quick);
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ id: EXP, status: "pending" });
    expect(world.submits[0]!.rounds).toEqual([{ name: "Overview", tips: quick.freeText, questions: [] }]);
    expect(world.submits[0]!.consent).toBe(true);
  });

  it("maps a detailed submission round by round", async () => {
    const { app, world } = setup();
    await request(app).post("/api/v1/experiences").set(S).send(detailed);
    expect(world.submits[0]!.rounds).toEqual([{ name: "Technical", tips: "Say tests first", questions: [{ text: "Reverse a list", topic: "Linked lists" }] }]);
  });

  it("never lets the client choose identity or status: unknown keys are stripped", async () => {
    const { app, world } = setup();
    await request(app).post("/api/v1/experiences").set(S).send({ ...quick, userId: "x", authorBatch: 2000, authorBranch: "ECE", status: "published", role2: "admin", upvoteCount: 999 });
    const sent = JSON.stringify(world.submits[0]);
    for (const bad of ["userId", "authorBatch", "authorBranch", "status", "upvoteCount", "role2"]) expect(sent).not.toContain(bad);
  });

  it("rejects missing consent, wrong mode content, and a future year with field errors", async () => {
    const { app } = setup();
    const noConsent = await request(app).post("/api/v1/experiences").set(S).send({ ...quick, consent: false });
    expect(noConsent.status).toBe(400);
    expect(noConsent.body.error.fields.consent).toBeDefined();
    expect((await request(app).post("/api/v1/experiences").set(S).send({ ...detailed, rounds: [] })).status).toBe(400);
    expect((await request(app).post("/api/v1/experiences").set(S).send({ ...quick, interviewYear: 2999 })).status).toBe(400);
  });

  it("allows 5 a day per user, then 429, without affecting another user", async () => {
    const { app } = setup({ limiter: new FakeLimiter(5) });
    for (let i = 0; i < 5; i++) expect((await request(app).post("/api/v1/experiences").set(S).send(quick)).status).toBe(201);
    const sixth = await request(app).post("/api/v1/experiences").set(S).send(quick);
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.code).toBe("RATE_LIMITED");
    expect((await request(app).post("/api/v1/experiences").set(A).send(quick)).status).toBe(201);
  });
});

describe("author lifecycle", () => {
  it("unpublish is instant; republish goes back to review; wrong transitions are 409", async () => {
    const w = new FakeWorld(); w.status.set(EXP, "published");
    const { app } = setup({ world: w });
    expect((await request(app).post(`/api/v1/experiences/${EXP}/unpublish`).set(S)).body.data.status).toBe("unpublished");
    expect((await request(app).post(`/api/v1/experiences/${EXP}/unpublish`).set(S)).status).toBe(409);
    expect((await request(app).post(`/api/v1/experiences/${EXP}/republish`).set(S)).body.data.status).toBe("pending");
    expect((await request(app).post(`/api/v1/experiences/${EXP}/republish`).set(S)).status).toBe(409);
  });
  it("404s for an unknown experience and 400s for a bad id", async () => {
    const { app } = setup();
    expect((await request(app).post("/api/v1/experiences/00000000-0000-4000-8000-0000000000ff/unpublish").set(S)).status).toBe(404);
    expect((await request(app).post("/api/v1/experiences/nope/unpublish").set(S)).status).toBe(400);
  });
});

describe("votes and bookmarks are idempotent", () => {
  it("a double PUT leaves one vote; DELETE removes it", async () => {
    const { app } = setup();
    await request(app).put(`/api/v1/experiences/${EXP}/vote`).set(S);
    const second = await request(app).put(`/api/v1/experiences/${EXP}/vote`).set(S);
    expect(second.body.data).toEqual({ voted: true, upvoteCount: 1 });
    expect((await request(app).delete(`/api/v1/experiences/${EXP}/vote`).set(S)).body.data).toEqual({ voted: false, upvoteCount: 0 });
  });

  it("two users each count once", async () => {
    const { app } = setup();
    await request(app).put(`/api/v1/experiences/${EXP}/vote`).set(S);
    const r = await request(app).put(`/api/v1/experiences/${EXP}/vote`).set(A);
    expect(r.body.data.upvoteCount).toBe(2);
  });

  it("bookmarks are private to the caller and idempotent", async () => {
    const { app } = setup();
    await request(app).put(`/api/v1/experiences/${EXP}/bookmark`).set(S);
    await request(app).put(`/api/v1/experiences/${EXP}/bookmark`).set(S);
    const mine = await request(app).get(`/api/v1/me/interactions?ids=${EXP}`).set(S);
    expect(mine.body.data).toEqual({ voted: [], bookmarked: [EXP] });
    const theirs = await request(app).get(`/api/v1/me/interactions?ids=${EXP}`).set(A);
    expect(theirs.body.data.bookmarked).toEqual([]);
    expect(mine.headers["cache-control"]).toBe("private, no-store");
  });

  it("requires sign-in and a valid id, and limits interactions to 60 a minute", async () => {
    expect((await request(setup().app).put(`/api/v1/experiences/${EXP}/vote`)).status).toBe(401);
    expect((await request(setup().app).put("/api/v1/experiences/xyz/vote").set(S)).status).toBe(400);
    const { app } = setup({ limiter: new FakeLimiter(2) });
    await request(app).put(`/api/v1/experiences/${EXP}/vote`).set(S);
    await request(app).put(`/api/v1/experiences/${EXP}/bookmark`).set(S);
    expect((await request(app).put(`/api/v1/experiences/${EXP}/vote`).set(S)).status).toBe(429);
  });

  it("validates the interaction id list", async () => {
    const { app } = setup();
    expect((await request(app).get("/api/v1/me/interactions").set(S)).status).toBe(400);
    expect((await request(app).get("/api/v1/me/interactions?ids=not-a-uuid").set(S)).status).toBe(400);
    const many = Array.from({ length: 51 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`).join(",");
    expect((await request(app).get(`/api/v1/me/interactions?ids=${many}`).set(S)).status).toBe(400);
  });
});

describe("reports", () => {
  it("creates one, rejects a bad reason, and returns 409 for a duplicate", async () => {
    const { app } = setup();
    expect((await request(app).post(`/api/v1/experiences/${EXP}/reports`).set(S).send({ reason: "nonsense" })).status).toBe(400);
    const ok = await request(app).post(`/api/v1/experiences/${EXP}/reports`).set(S).send({ reason: "abusive", note: "rude" });
    expect(ok.status).toBe(201);
    expect((await request(app).post(`/api/v1/experiences/${EXP}/reports`).set(S).send({ reason: "abusive" })).status).toBe(409);
  });
});

describe("profile and lists", () => {
  it("PATCH /me updates only allowed fields and refuses an empty body", async () => {
    const { app, world } = setup();
    expect((await request(app).patch("/api/v1/me").set(S).send({})).status).toBe(400);
    const r = await request(app).patch("/api/v1/me").set(S).send({ graduationBatch: 2027, branch: "CSE", role: "admin", email: "x@y.z" });
    expect(r.status).toBe(200);
    expect(world.profileUpdates[0]).toEqual({ graduationBatch: 2027, branch: "CSE" });
    expect((await request(app).patch("/api/v1/me").set(S).send({ branch: "Biology" })).status).toBe(400);
  });

  it("paginates bookmarks with a cursor", async () => {
    const w = new FakeWorld();
    w.bookmarkRows = [1, 2, 3].map((n) => ({ ...card(n), bookmarkedAt: card(n).createdAt }));
    const { app } = setup({ world: w });
    const p1 = await request(app).get("/api/v1/me/bookmarks?limit=2").set(S);
    expect(p1.body.data).toHaveLength(2);
    expect(p1.body.page.hasMore).toBe(true);
    const p2 = await request(app).get(`/api/v1/me/bookmarks?limit=2&cursor=${p1.body.page.nextCursor}`).set(S);
    expect(p2.body.data).toHaveLength(1);
    expect(p2.body.page.hasMore).toBe(false);
  });

  it("lists companies publicly", async () => {
    const res = await request(setup().app).get("/api/v1/companies?prefix=exa");
    expect(res.status).toBe(200);
    expect(res.body.data[0].slug).toBe("example-co");
    expect(res.headers["cache-control"]).toContain("public");
  });
});

describe("moderation (admin)", () => {
  it("keeps students out of the queue and of every decision, and visitors out with 401", async () => {
    const { app } = setup();
    expect((await request(app).get("/api/v1/admin/experiences").set(S)).status).toBe(403);
    expect((await request(app).post(`/api/v1/admin/experiences/${EXP}/approve`).set(S)).status).toBe(403);
    expect((await request(app).post(`/api/v1/admin/experiences/${EXP}/approve`)).status).toBe(401);
  });

  it("approves, then a second decision on the same post is a 409 (compare-and-set)", async () => {
    const { app, world } = setup();
    const first = await request(app).post(`/api/v1/admin/experiences/${EXP}/approve`).set(A);
    expect(first.body.data.status).toBe("published");
    expect((await request(app).post(`/api/v1/admin/experiences/${EXP}/approve`).set(A)).status).toBe(409);
    expect(world.moderations).toHaveLength(1);
  });

  it("requires a note to reject, and passes it through", async () => {
    const { app, world } = setup();
    const bad = await request(app).post(`/api/v1/admin/experiences/${EXP}/reject`).set(A).send({});
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.note).toBeDefined();
    const ok = await request(app).post(`/api/v1/admin/experiences/${EXP}/reject`).set(A).send({ note: "Names the interviewer." });
    expect(ok.body.data.status).toBe("rejected");
    expect(world.moderations[0]).toEqual({ id: EXP, action: "reject", note: "Names the interviewer." });
  });

  it("walks remove then reinstate, and rejects an unknown action", async () => {
    const w = new FakeWorld(); w.status.set(EXP, "published");
    const { app } = setup({ world: w });
    expect((await request(app).post(`/api/v1/admin/experiences/${EXP}/remove`).set(A)).body.data.status).toBe("removed");
    expect((await request(app).post(`/api/v1/admin/experiences/${EXP}/reinstate`).set(A)).body.data.status).toBe("pending");
    expect((await request(app).post(`/api/v1/admin/experiences/${EXP}/delete-forever`).set(A)).status).toBe(400);
  });

  it("lists the queue by status", async () => {
    const w = new FakeWorld();
    w.queue = [{ ...card(1), status: "pending", reviewNote: null, openReports: 0 }];
    const { app } = setup({ world: w });
    const res = await request(app).get("/api/v1/admin/experiences?status=pending").set(A);
    expect(res.body.data).toHaveLength(1);
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect((await request(app).get("/api/v1/admin/experiences?status=bogus").set(A)).status).toBe(400);
  });

  it("the service refuses a non-admin viewer even if the route guard were removed", async () => {
    const { container } = setup();
    const student = { kind: "user" as const, id: USERS["tok-student"]!.userId, email: "a@nst.rishihood.edu.in", role: "student" as const, token: "t" };
    const svc = new ModerationService(container.repositories.for(student).moderation, container.repositories.for(student).adminQueue, student);
    await expect(svc.execute(ModerationCommandFactory.create("approve", EXP))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(svc.list({ status: "pending", limit: 5 })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("design classes", () => {
  it("SubmissionFactory returns the right subclass and both honour the same contract (Liskov)", () => {
    const q = SubmissionFactory.create(quick as SubmissionDto);
    const d = SubmissionFactory.create(detailed as SubmissionDto);
    expect(q).toBeInstanceOf(QuickSubmission);
    expect(d).toBeInstanceOf(DetailedSubmission);
    for (const s of [q, d]) {
      const p = s.toPayload();
      expect(p.consent).toBe(true);
      expect(p.rounds.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("DetailedSubmission rejects an absurd question count; RejectCommand needs a note", () => {
    const many = { ...detailed, rounds: Array.from({ length: 5 }, () => ({ name: "R", questions: Array.from({ length: 30 }, () => ({ text: "q" })) })) } as SubmissionDto;
    expect(() => SubmissionFactory.create(many).toPayload()).toThrow(ValidationError);
    expect(() => ModerationCommandFactory.create("reject", EXP)).toThrow(ValidationError);
    expect(() => ModerationCommandFactory.create("reject", EXP, "  ")).toThrow(ValidationError);
  });
});
