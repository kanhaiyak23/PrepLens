import { buildServices } from "../src/container.js";
import { AuthenticationError, ConflictError, ForbiddenError, NotFoundError } from "../src/domain/errors.js";
import { isAdmin } from "../src/domain/viewer.js";
import { createLogger } from "../src/lib/logger.js";
export const card = (n, over = {}) => ({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    company: { name: "Example Co", slug: "example-co" },
    role: "SDE", driveType: "on-campus", interviewYear: 2026, interviewMonth: 3, outcome: "selected", campus: "ru",
    roundCount: 2, upvoteCount: 0,
    // newest first: higher n is older, so list order is n = 1, 2, 3...
    createdAt: new Date(Date.UTC(2026, 5, 30, 12, 0, 0) - n * 60_000).toISOString(), updatedAt: null,
    author: { anonymous: true, batch: 2027 },
    ...over,
});
export const EXP = card(50).id;
export class FakeExperienceReader {
    cards;
    details;
    calls = [];
    constructor(cards = [], details = new Map()) {
        this.cards = cards;
        this.details = details;
    }
    async findPage(q) {
        this.calls.push(q);
        const start = q.after ? this.cards.findIndex((c) => c.id === q.after.id) + 1 : 0;
        return this.cards.slice(start, start + q.limit);
    }
    async findById(id) { return this.details.get(id) ?? null; }
}
export const USERS = {
    "tok-student": { userId: "11111111-1111-4111-8111-111111111111", email: "asha@nst.rishihood.edu.in", role: "student" },
    "tok-admin": { userId: "22222222-2222-4222-8222-222222222222", email: "boss@nst.rishihood.edu.in", role: "admin" },
};
export class FakeVerifier {
    async verify(token) {
        const u = USERS[token];
        if (!u)
            throw new AuthenticationError("Your session is not valid. Please sign in again.");
        return { userId: u.userId, email: u.email };
    }
}
/** Allows the first `max` calls per key+action, then denies. Mirrors the real fixed-window limiter. */
export class FakeLimiter {
    max;
    keys = [];
    counts = new Map();
    constructor(max = Infinity) {
        this.max = max;
    }
    async consume(key, action) {
        this.keys.push(key);
        const k = `${key}|${action}`;
        const n = (this.counts.get(k) ?? 0) + 1;
        this.counts.set(k, n);
        return n <= this.max;
    }
}
/** In-memory stand-in for the database functions' observable behaviour. Used so no unit test needs a database. */
export class FakeGuideRepo {
    saved = [];
    store = new Map();
    async find(id) { return this.store.get(id) ?? null; }
    async save(g) { this.saved.push(g); this.store.set(g.companyId, g); }
}
export class FakeLlm {
    reply;
    calls = [];
    constructor(reply = () => ({})) {
        this.reply = reply;
    }
    async generateJson(req) { this.calls.push(req); return { data: await this.reply(), model: "fake-model" }; }
}
export const source = (n, over = {}) => ({
    id: `00000000-0000-4000-8000-${String(900 + n).padStart(12, "0")}`, role: "SDE", driveType: "on-campus", interviewYear: 2026, outcome: n % 2 ? "selected" : "rejected",
    updatedAt: `2026-06-0${(n % 9) + 1}T10:00:00.000Z`, author: { anonymous: true, batch: 2027 },
    rounds: [{ name: "Technical", tips: "Say tests first", questions: [{ text: `Question ${n}`, topic: n % 2 ? "Linked lists" : "Arrays" }] }], ...over,
});
export const sourcesOf = (count) => ({ company: { id: "44444444-4444-4444-8444-444444444444", name: "Example Co", slug: "example-co" }, experiences: Array.from({ length: count }, (_, i) => source(i + 1)) });
export class FakeDeleter {
    calls = [];
    async delete(userId, keepLive) { this.calls.push({ userId, keepLive }); return { kept: keepLive ? 1 : 0, deleted: 2 }; }
}
export class FakeWorld {
    edits = [];
    queuedFor = new Set();
    updatesQueue = [{ id: EXP, company: { name: "Example Co", slug: "example-co" }, role: "SDE", outcome: "in-process", interviewYear: 2026, changes: { outcome: "selected" }, submittedAt: "2026-06-01T00:00:00Z" }];
    updateDecisions = [];
    reportRows = [{ id: "33333333-3333-4333-8333-333333333333", experienceId: EXP, companyName: "Example Co", role: "SDE", experienceStatus: "published", reason: "abusive", note: "rude", status: "open", createdAt: "2026-06-01T00:00:00Z" }];
    dismissed = [];
    adminPosts = [];
    sources = sourcesOf(3);
    pendingCompanies = [{ name: "Googel", slug: "googel", createdAt: "2026-06-01T00:00:00Z", postCount: 1 }];
    companyDecisions = [];
    submits = [];
    status = new Map([[EXP, "pending"]]);
    votes = new Map(); // experienceId -> userIds
    bookmarks = new Map();
    reports = [];
    moderations = [];
    profileUpdates = [];
    bookmarkRows = [];
    queue = [];
}
export function makeContainer(opts = {}) {
    const reader = opts.reader ?? new FakeExperienceReader();
    const limiter = opts.limiter ?? new FakeLimiter();
    const world = opts.world ?? new FakeWorld();
    const guides = opts.guides ?? new FakeGuideRepo();
    const deleter = opts.deleter ?? new FakeDeleter();
    const shared = { guides, llm: opts.llm === undefined ? null : opts.llm, logger: createLogger("silent"), deleter };
    const repositories = {
        for: (viewer) => {
            const uid = viewer.kind === "user" ? viewer.id : null;
            const need = () => { if (!uid)
                throw new AuthenticationError("Sign in required."); return uid; };
            const userRow = () => Object.values(USERS).find((x) => x.userId === uid);
            const meOf = () => ({ id: userRow().userId, email: userRow().email, fullName: "Test", avatarUrl: null, graduationBatch: 2027, branch: "CSE", role: userRow().role, profileComplete: true });
            return {
                experiences: reader,
                mine: {
                    async listMine() { need(); return []; },
                    async listBookmarks(q) {
                        need();
                        const start = q.after ? world.bookmarkRows.findIndex((b) => b.id === q.after.id) + 1 : 0;
                        return world.bookmarkRows.slice(start, start + q.limit);
                    },
                },
                adminQueue: { async list(q) { if (!isAdmin(viewer))
                        throw new ForbiddenError("Admins only."); return world.queue.filter((c) => c.status === q.status).slice(0, q.limit); } },
                companies: { async list() { return [{ name: "Example Co", slug: "example-co", experienceCount: 3 }]; } },
                experienceWriter: {
                    async submit(p) { need(); world.submits.push(p); return EXP; },
                    async update(id, changes) {
                        need();
                        const cur = world.status.get(id);
                        if (!cur)
                            throw new NotFoundError("Experience not found.");
                        world.edits.push({ id, changes });
                        return cur === "published" ? "queued" : "applied"; // live posts queue; others apply directly
                    },
                    async cancelUpdate(id) { need(); if (!world.queuedFor.has(id))
                        throw new NotFoundError("There is no pending update to cancel."); world.queuedFor.delete(id); },
                    async setVisibility(id, publish) {
                        need();
                        const cur = world.status.get(id);
                        if (!cur)
                            throw new NotFoundError("Experience not found.");
                        if (publish && cur !== "unpublished")
                            throw new ConflictError("This experience cannot move to that state from where it is.");
                        if (!publish && cur !== "published" && cur !== "pending")
                            throw new ConflictError("This experience cannot move to that state from where it is.");
                        const next = publish ? "pending" : "unpublished";
                        world.status.set(id, next);
                        return next;
                    },
                },
                interactions: {
                    async setVote(id, on) {
                        const u = need();
                        const set = world.votes.get(id) ?? new Set();
                        world.votes.set(id, set);
                        if (on)
                            set.add(u);
                        else
                            set.delete(u); // set semantics = the primary key
                        return { voted: on, upvoteCount: set.size };
                    },
                    async setBookmark(id, on) {
                        const u = need();
                        const set = world.bookmarks.get(id) ?? new Set();
                        world.bookmarks.set(id, set);
                        if (on)
                            set.add(u);
                        else
                            set.delete(u);
                        return { bookmarked: on };
                    },
                    async interactions(ids) {
                        const u = need();
                        return { voted: ids.filter((i) => world.votes.get(i)?.has(u)), bookmarked: ids.filter((i) => world.bookmarks.get(i)?.has(u)) };
                    },
                },
                reports: {
                    async report(id, reason, note) {
                        const u = need();
                        if (world.reports.some((r) => r.by === u))
                            throw new ConflictError("You already have an open report on this experience.");
                        const rep = { id: "33333333-3333-4333-8333-333333333333", reason, by: u, ...(note ? { note } : {}) };
                        world.reports.push(rep);
                        void id;
                        return rep.id;
                    },
                },
                moderation: {
                    async moderate(id, action, note) {
                        need();
                        if (!isAdmin(viewer))
                            throw new ForbiddenError("Admins only.");
                        const from = { approve: "pending", reject: "pending", remove: "published", reinstate: "removed" }[action];
                        const to = { approve: "published", reject: "rejected", remove: "removed", reinstate: "pending" }[action];
                        if (world.status.get(id) !== from)
                            throw new ConflictError(`This experience is no longer ${from}.`); // compare-and-set
                        world.status.set(id, to);
                        world.moderations.push({ id, action, ...(note ? { note } : {}) });
                        return to;
                    },
                },
                profiles: { async getMe() { return uid ? meOf() : null; } },
                profileWriter: { async update(dto) { need(); world.profileUpdates.push(dto); return { ...meOf(), ...(dto.fullName ? { fullName: dto.fullName } : {}) }; } },
                guideSources: { async forCompany() { return world.sources; } },
                updateReview: {
                    async list() { if (!isAdmin(viewer))
                        throw new ForbiddenError("Admins only."); return world.updatesQueue; },
                    async decide(id, approve, note) {
                        if (!isAdmin(viewer))
                            throw new ForbiddenError("Admins only.");
                        if (!world.updatesQueue.some((u) => u.id === id))
                            throw new ConflictError("There is no pending update on this experience.");
                        world.updateDecisions.push({ id, approve, ...(note ? { note } : {}) });
                        world.updatesQueue = world.updatesQueue.filter((u) => u.id !== id);
                        return approve ? "applied" : "rejected";
                    },
                },
                reportQueue: {
                    async list(status) { if (!isAdmin(viewer))
                        throw new ForbiddenError("Admins only."); return world.reportRows.filter((r) => r.status === status); },
                    async dismiss(id) {
                        if (!isAdmin(viewer))
                            throw new ForbiddenError("Admins only.");
                        const r = world.reportRows.find((x) => x.id === id);
                        if (!r)
                            throw new NotFoundError("Report not found.");
                        if (r.status !== "open")
                            throw new ConflictError("This report is already settled.");
                        r.status = "dismissed";
                        world.dismissed.push(id);
                        return "dismissed";
                    },
                },
                adminPost: { async post(p) { if (!isAdmin(viewer))
                        throw new ForbiddenError("Admins only."); world.adminPosts.push(p); return EXP; } },
                companyAdmin: {
                    async listPending() { if (!isAdmin(viewer))
                        throw new ForbiddenError("Admins only."); return world.pendingCompanies; },
                    async decide(slug, action, mergeInto) {
                        if (!isAdmin(viewer))
                            throw new ForbiddenError("Admins only.");
                        if (!world.pendingCompanies.some((c) => c.slug === slug))
                            throw new ConflictError("This company is no longer pending.");
                        world.companyDecisions.push({ slug, action, ...(mergeInto ? { mergeInto } : {}) });
                        world.pendingCompanies = world.pendingCompanies.filter((c) => c.slug !== slug);
                        return action === "approve" ? "active" : "merged";
                    },
                },
            };
        },
    };
    const container = {
        config: { NODE_ENV: "test", FRONTEND_URL: "http://localhost:3100" },
        logger: createLogger("silent"),
        verifier: new FakeVerifier(),
        limiter,
        repositories,
        servicesFor: (viewer) => buildServices(repositories, viewer, shared),
    };
    return { container, reader, limiter, world, guides, deleter };
}
