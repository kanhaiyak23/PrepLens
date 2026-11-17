import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { AccountService } from "../src/services/AccountService.js";
import { AdminOpsService } from "../src/services/AdminOpsService.js";
import { ForbiddenError } from "../src/domain/errors.js";
import { EXP, FakeDeleter, FakeLimiter, FakeWorld, USERS, makeContainer } from "./fakes.js";

const S = { Authorization: "Bearer tok-student" };
const A = { Authorization: "Bearer tok-admin" };
const setup = (o: Parameters<typeof makeContainer>[0] = {}) => { const m = makeContainer(o); return { ...m, app: createApp(m.container) }; };

describe("edit and result update (author)", () => {
  it("a live post answers 202 queued; a post that is not live answers 200 applied", async () => {
    const live = new FakeWorld(); live.status.set(EXP, "published");
    const a = setup({ world: live });
    const queued = await request(a.app).patch(`/api/v1/experiences/${EXP}`).set(S).send({ outcome: "selected" });
    expect(queued.status).toBe(202);
    expect(queued.body.data.result).toBe("queued");
    const direct = await request(setup().app).patch(`/api/v1/experiences/${EXP}`).set(S).send({ outcome: "selected" });
    expect(direct.status).toBe(200);
    expect(direct.body.data.result).toBe("applied");
  });

  it("is a result update when only the outcome is sent, and strips fields a client must not set", async () => {
    const { app, world } = setup();
    await request(app).patch(`/api/v1/experiences/${EXP}`).set(S).send({ outcome: "rejected", status: "published", authorBatch: 1999, upvoteCount: 99, userId: "x" });
    expect(world.edits[0]!.changes).toEqual({ outcome: "rejected" });
  });

  it("maps round edits to the database shape", async () => {
    const { app, world } = setup();
    await request(app).patch(`/api/v1/experiences/${EXP}`).set(S).send({ rounds: [{ name: "Tech", tips: "x", questions: [{ text: "q", topic: "Arrays" }, { text: "q2" }] }] });
    expect(world.edits[0]!.changes.rounds).toEqual([{ name: "Tech", tips: "x", questions: [{ text: "q", topic: "Arrays" }, { text: "q2" }] }]);
  });

  it("rejects an empty edit, bad values, a future year, a bad id; needs sign-in; is rate limited", async () => {
    const { app } = setup();
    expect((await request(app).patch(`/api/v1/experiences/${EXP}`).set(S).send({})).status).toBe(400);
    expect((await request(app).patch(`/api/v1/experiences/${EXP}`).set(S).send({ outcome: "maybe" })).status).toBe(400);
    expect((await request(app).patch(`/api/v1/experiences/${EXP}`).set(S).send({ interviewYear: 2999 })).status).toBe(400);
    expect((await request(app).patch("/api/v1/experiences/nope").set(S).send({ outcome: "selected" })).status).toBe(400);
    expect((await request(app).patch(`/api/v1/experiences/${EXP}`).send({ outcome: "selected" })).status).toBe(401);
    const limited = setup({ limiter: new FakeLimiter(1) });
    await request(limited.app).patch(`/api/v1/experiences/${EXP}`).set(S).send({ outcome: "selected" });
    expect((await request(limited.app).patch(`/api/v1/experiences/${EXP}`).set(S).send({ outcome: "selected" })).status).toBe(429);
  });

  it("cancels a waiting update (204) and 404s when there is none", async () => {
    const w = new FakeWorld(); w.queuedFor.add(EXP);
    const { app } = setup({ world: w });
    expect((await request(app).delete(`/api/v1/experiences/${EXP}/update`).set(S)).status).toBe(204);
    expect((await request(app).delete(`/api/v1/experiences/${EXP}/update`).set(S)).status).toBe(404);
  });
});

describe("admin: review of edits", () => {
  it("is admin only, lists the queue, approves, and requires a note to reject", async () => {
    const { app, world } = setup();
    expect((await request(app).get("/api/v1/admin/updates").set(S)).status).toBe(403);
    expect((await request(app).get("/api/v1/admin/updates")).status).toBe(401);
    expect((await request(app).get("/api/v1/admin/updates").set(A)).body.data[0].changes).toEqual({ outcome: "selected" });
    const noNote = await request(app).post(`/api/v1/admin/experiences/${EXP}/update/reject`).set(A).send({});
    expect(noNote.status).toBe(400);
    expect(noNote.body.error.fields.note).toBeDefined();
    expect((await request(app).post(`/api/v1/admin/experiences/${EXP}/update/approve`).set(A)).body.data.result).toBe("applied");
    expect(world.updateDecisions).toEqual([{ id: EXP, approve: true }]);
    expect((await request(app).post(`/api/v1/admin/experiences/${EXP}/update/approve`).set(A)).status).toBe(409);
    expect((await request(app).post(`/api/v1/admin/experiences/${EXP}/update/nuke`).set(A)).status).toBe(400);
  });
});

describe("admin: reports queue", () => {
  it("lists open reports, dismisses once, 409 the second time, and keeps students out", async () => {
    const { app, world } = setup();
    const id = world.reportRows[0]!.id;
    expect((await request(app).get("/api/v1/admin/reports").set(S)).status).toBe(403);
    expect((await request(app).get("/api/v1/admin/reports").set(A)).body.data).toHaveLength(1);
    expect((await request(app).get("/api/v1/admin/reports?status=bogus").set(A)).status).toBe(400);
    expect((await request(app).post(`/api/v1/admin/reports/${id}/dismiss`).set(A)).body.data.result).toBe("dismissed");
    expect((await request(app).post(`/api/v1/admin/reports/${id}/dismiss`).set(A)).status).toBe(409);
    expect((await request(app).get("/api/v1/admin/reports").set(A)).body.data).toHaveLength(0);
  });
});

describe("admin: post on behalf of a student", () => {
  const base = { mode: "quick", company: "Example Co", role: "SDE", driveType: "on-campus", interviewYear: 2026, outcome: "selected", isAnonymous: false, freeText: "Two rounds.", studentConsented: true, authorName: "Maya Rao", authorBatch: 2026, authorBranch: "ECE", campus: "bangalore" };

  it("needs an admin, the student's consent, a name, and normalises to rounds like a student post", async () => {
    const { app, world } = setup();
    expect((await request(app).post("/api/v1/admin/experiences").set(S).send(base)).status).toBe(403);
    expect((await request(app).post("/api/v1/admin/experiences").set(A).send({ ...base, studentConsented: false })).status).toBe(400);
    expect((await request(app).post("/api/v1/admin/experiences").set(A).send({ ...base, authorName: "" })).status).toBe(400);
    const ok = await request(app).post("/api/v1/admin/experiences").set(A).send(base);
    expect(ok.status).toBe(201);
    const p = world.adminPosts[0]!;
    expect(p.studentConsented).toBe(true);
    expect(p.authorName).toBe("Maya Rao");
    expect(p.campus).toBe("bangalore");
    expect(p.rounds).toEqual([{ name: "Overview", tips: "Two rounds.", questions: [] }]);
    expect(p).not.toHaveProperty("consent");
    expect(p).not.toHaveProperty("mode");
  });

  it("the service refuses a non-admin even without the route guard", async () => {
    const { container } = setup();
    const v = { kind: "user" as const, id: USERS["tok-student"]!.userId, email: "a@nst.rishihood.edu.in", role: "student" as const, token: "t" };
    const r = container.repositories.for(v);
    const svc = new AdminOpsService(r.updateReview, r.reportQueue, r.adminPost, v);
    await expect(svc.listUpdates()).rejects.toBeInstanceOf(ForbiddenError);
    await expect(svc.postOnBehalf(base as never)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("DELETE /me (account deletion)", () => {
  it("requires an explicit choice and sign-in", async () => {
    const { app } = setup();
    expect((await request(app).delete("/api/v1/me").set(S)).status).toBe(400);
    expect((await request(app).delete("/api/v1/me?posts=maybe").set(S)).status).toBe(400);
    expect((await request(app).delete("/api/v1/me?posts=keep")).status).toBe(401);
  });

  it("passes the choice through: keep means keepLive, delete means everything", async () => {
    const d = new FakeDeleter();
    const { app } = setup({ deleter: d });
    const keep = await request(app).delete("/api/v1/me?posts=keep").set(S);
    expect(keep.body.data).toEqual({ kept: 1, deleted: 2 });
    await request(app).delete("/api/v1/me?posts=delete").set(S);
    expect(d.calls).toEqual([{ userId: USERS["tok-student"]!.userId, keepLive: true }, { userId: USERS["tok-student"]!.userId, keepLive: false }]);
  });

  it("refuses admins (the audit log must keep resolving to a person) and never calls the deleter", async () => {
    const d = new FakeDeleter();
    const res = await request(setup({ deleter: d }).app).delete("/api/v1/me?posts=delete").set(A);
    expect(res.status).toBe(403);
    expect(d.calls).toHaveLength(0);
  });

  it("is limited to 3 a day and the service refuses a visitor", async () => {
    const lim = setup({ limiter: new FakeLimiter(0) });
    expect((await request(lim.app).delete("/api/v1/me?posts=keep").set(S)).status).toBe(429);
    await expect(new AccountService(new FakeDeleter(), { kind: "visitor" }).delete("keep")).rejects.toBeTruthy();
  });
});
