import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { AdminRoleService } from "../src/services/AdminRoleService.js";
import type { AdminRoleWriter } from "../src/domain/ports.js";
import { FakeLimiter, USERS, makeContainer } from "./fakes.js";

/** Admin roles (ADR-31): admins make other people admin or remove their access; never their own, never the last admin. */
const S = { Authorization: "Bearer tok-student" };
const A = { Authorization: "Bearer tok-admin" };
const RAVI = "55555555-5555-4555-8555-555555555555";
const BOSS = USERS["tok-admin"]!.userId;
const setup = (o: Parameters<typeof makeContainer>[0] = {}) => { const m = makeContainer(o); return { ...m, app: createApp(m.container) }; };

describe("GET /admin/admins", () => {
  it("lists the admins and marks the caller", async () => {
    const res = await request(setup().app).get("/api/v1/admin/admins").set(A);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: BOSS, email: "boss@nst.rishihood.edu.in", fullName: "Boss", joinedAt: "2026-01-01T00:00:00Z", isSelf: true }]);
    expect(res.headers["cache-control"]).toMatch(/no-store/);
  });

  it("needs sign-in (401) and the admin role (403)", async () => {
    const { app } = setup();
    expect((await request(app).get("/api/v1/admin/admins")).status).toBe(401);
    const asStudent = await request(app).get("/api/v1/admin/admins").set(S);
    expect(asStudent.status).toBe(403);
    expect(asStudent.body.error.code).toBe("FORBIDDEN");
  });
});

describe("POST /admin/admins (grant)", () => {
  it("makes a student an admin by email, normalising case and spaces, and logs it", async () => {
    const { app, world } = setup();
    const res = await request(app).post("/api/v1/admin/admins").set(A).send({ email: "  Ravi@NST.rishihood.edu.in " });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: RAVI, email: "ravi@nst.rishihood.edu.in", isSelf: false });
    expect(world.accounts.get("ravi@nst.rishihood.edu.in")!.role).toBe("admin");
    expect(world.roleChanges).toEqual([{ action: "grant-admin", email: "ravi@nst.rishihood.edu.in" }]);
    const list = await request(app).get("/api/v1/admin/admins").set(A);
    expect(list.body.data.map((a: { email: string }) => a.email)).toContain("ravi@nst.rishihood.edu.in");
  });

  it("answers 409 for someone who is already an admin, including yourself", async () => {
    const { app } = setup();
    await request(app).post("/api/v1/admin/admins").set(A).send({ email: "ravi@nst.rishihood.edu.in" });
    const again = await request(app).post("/api/v1/admin/admins").set(A).send({ email: "ravi@nst.rishihood.edu.in" });
    expect(again.status).toBe(409);
    expect(again.body.error.message).toMatch(/already an admin/);
    expect((await request(app).post("/api/v1/admin/admins").set(A).send({ email: "boss@nst.rishihood.edu.in" })).status).toBe(409);
  });

  it("answers 404 when nobody with that email has signed in yet", async () => {
    const res = await request(setup().app).post("/api/v1/admin/admins").set(A).send({ email: "new@nst.rishihood.edu.in" });
    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/sign in once/);
  });

  it("rejects a missing or invalid email (400) and ignores fields a client must not set", async () => {
    const { app, world } = setup();
    expect((await request(app).post("/api/v1/admin/admins").set(A).send({})).status).toBe(400);
    const bad = await request(app).post("/api/v1/admin/admins").set(A).send({ email: "not-an-email" });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("VALIDATION_FAILED");
    await request(app).post("/api/v1/admin/admins").set(A).send({ email: "ravi@nst.rishihood.edu.in", role: "student", userId: BOSS });
    expect(world.accounts.get("ravi@nst.rishihood.edu.in")!.role).toBe("admin");
  });

  it("is refused for students and visitors, and changes nothing", async () => {
    const { app, world } = setup();
    expect((await request(app).post("/api/v1/admin/admins").send({ email: "ravi@nst.rishihood.edu.in" })).status).toBe(401);
    expect((await request(app).post("/api/v1/admin/admins").set(S).send({ email: "asha@nst.rishihood.edu.in" })).status).toBe(403);
    expect(world.roleChanges).toEqual([]);
  });

  it("is rate limited per admin (429)", async () => {
    const { app } = setup({ limiter: new FakeLimiter(0) });
    expect((await request(app).post("/api/v1/admin/admins").set(A).send({ email: "ravi@nst.rishihood.edu.in" })).status).toBe(429);
  });
});

describe("DELETE /admin/admins/:id (revoke)", () => {
  it("removes another admin's access and logs it", async () => {
    const { app, world } = setup();
    await request(app).post("/api/v1/admin/admins").set(A).send({ email: "ravi@nst.rishihood.edu.in" });
    const res = await request(app).delete(`/api/v1/admin/admins/${RAVI}`).set(A);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: RAVI, isSelf: false });
    expect(world.accounts.get("ravi@nst.rishihood.edu.in")!.role).toBe("student");
    expect(world.roleChanges.map((c) => c.action)).toEqual(["grant-admin", "revoke-admin"]);
  });

  it("never lets an admin remove their own access (403)", async () => {
    const { app, world } = setup();
    const res = await request(app).delete(`/api/v1/admin/admins/${BOSS}`).set(A);
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/your own admin access/);
    expect(world.accounts.get("boss@nst.rishihood.edu.in")!.role).toBe("admin");
  });

  it("answers 409 for someone who is not an admin, 404 for an unknown id, 400 for a bad id", async () => {
    const { app } = setup();
    expect((await request(app).delete(`/api/v1/admin/admins/${RAVI}`).set(A)).status).toBe(409);
    expect((await request(app).delete("/api/v1/admin/admins/99999999-9999-4999-8999-999999999999").set(A)).status).toBe(404);
    expect((await request(app).delete("/api/v1/admin/admins/not-a-uuid").set(A)).status).toBe(400);
  });

  it("is refused for students (403) and visitors (401)", async () => {
    const { app } = setup();
    expect((await request(app).delete(`/api/v1/admin/admins/${BOSS}`).set(S)).status).toBe(403);
    expect((await request(app).delete(`/api/v1/admin/admins/${BOSS}`)).status).toBe(401);
  });
});

describe("AdminRoleService (defence in depth)", () => {
  // A writer that would accept anything: the service must still refuse, so the rule does not depend on the adapter.
  const permissive: AdminRoleWriter = {
    async list() { return []; },
    async grant(email) { return { id: RAVI, email, fullName: "x", joinedAt: "2026-01-01T00:00:00Z" }; },
    async revoke(id) { return { id, email: "x@nst.rishihood.edu.in", fullName: "x", joinedAt: "2026-01-01T00:00:00Z" }; },
  };
  const admin = { kind: "user" as const, id: BOSS, email: "boss@nst.rishihood.edu.in", role: "admin" as const, token: "t" };

  it("refuses visitors and students before calling the database", async () => {
    await expect(new AdminRoleService(permissive, { kind: "visitor" }).list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(new AdminRoleService(permissive, { ...admin, role: "student" }).grant("ravi@nst.rishihood.edu.in")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses self-removal and self-grant even if the writer would allow them", async () => {
    const svc = new AdminRoleService(permissive, admin);
    await expect(svc.revoke(BOSS)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(svc.grant("boss@nst.rishihood.edu.in")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(svc.revoke(RAVI)).resolves.toMatchObject({ id: RAVI, isSelf: false });
  });
});
