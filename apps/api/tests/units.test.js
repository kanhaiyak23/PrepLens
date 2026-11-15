import { describe, expect, it } from "vitest";
import { feedQuerySchema, submissionSchema } from "@preplens/shared";
import { AuthenticationError, ConflictError, ForbiddenError, NotFoundError, ValidationError, fromDbMessage } from "../src/domain/errors.js";
import { decodeCursor, encodeCursor } from "../src/lib/cursor.js";
import { loadConfig } from "../src/config/env.js";
import { toCard, toDetail } from "../src/infrastructure/supabase/mappers.js";
describe("cursor", () => {
    it("round-trips and rejects tampering", () => {
        const c = { createdAt: "2026-06-30T12:00:00.000Z", id: "00000000-0000-4000-8000-000000000001" };
        expect(decodeCursor(encodeCursor(c))).toEqual(c);
        expect(() => decodeCursor("%%%")).toThrow(ValidationError);
        expect(() => decodeCursor(Buffer.from(JSON.stringify({ c: "nope", i: "x" })).toString("base64url"))).toThrow(ValidationError);
    });
});
describe("database error mapping", () => {
    it("maps CODE: message to the right AppError", () => {
        expect(fromDbMessage("CONFLICT: already decided")).toBeInstanceOf(ConflictError);
        expect(fromDbMessage("FORBIDDEN: Admins only.")).toBeInstanceOf(ForbiddenError);
        expect(fromDbMessage("NOT_FOUND: x")).toBeInstanceOf(NotFoundError);
        expect(fromDbMessage("UNAUTHENTICATED: x")).toBeInstanceOf(AuthenticationError);
        expect(fromDbMessage("VALIDATION: bad")).toBeInstanceOf(ValidationError);
        expect(fromDbMessage("duplicate key value violates unique constraint")).toBeNull();
    });
});
describe("config", () => {
    it("lists every problem in plain words", () => {
        expect(() => loadConfig({ NODE_ENV: "test" })).toThrow(/SUPABASE_URL/);
        expect(() => loadConfig({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "a".repeat(30), SUPABASE_SERVICE_ROLE_KEY: "b".repeat(30), FRONTEND_URL: "http://localhost:3100/" })).toThrow(/FRONTEND_URL/);
    });
});
describe("mappers: anonymity cannot leak even if the row carried extra fields", () => {
    it("anonymous author becomes batch only", () => {
        const c = toCard({ id: "i", company_name: "C", company_slug: "c", role: "SDE", drive_type: "on-campus", interview_year: 2026, outcome: "selected", campus: "ru", round_count: 1, upvote_count: 0, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", author: { anonymous: true, batch: 2027, branch: "CSE", name: "Asha", id: "u1" } });
        expect(c.author).toEqual({ anonymous: true, batch: 2027 });
        expect(c.updatedAt).toBeNull();
        const d = toDetail({ id: "i", company: { name: "C", slug: "c" }, role: "SDE", drive_type: "on-campus", interview_year: 2026, outcome: "selected", campus: "ru", upvote_count: 0, created_at: "x", rounds: [], author: { anonymous: true, batch: 2027, branch: "CSE" } });
        expect(d.author).toEqual({ anonymous: true, batch: 2027 });
    });
});
describe("shared schemas", () => {
    const base = { company: "Example Co", role: "SDE", driveType: "on-campus", interviewYear: 2026, outcome: "selected", isAnonymous: true, consent: true };
    it("strips identity fields a client tries to send", () => {
        const parsed = submissionSchema.parse({ ...base, mode: "quick", freeText: "hello", userId: "u", role2: "admin", status: "published", authorBatch: 2020 });
        expect(parsed).not.toHaveProperty("userId");
        expect(parsed).not.toHaveProperty("status");
        expect(parsed).not.toHaveProperty("authorBatch");
    });
    it("requires literal consent, content for the chosen mode, and no future year", () => {
        expect(submissionSchema.safeParse({ ...base, mode: "quick", freeText: "x", consent: false }).success).toBe(false);
        expect(submissionSchema.safeParse({ ...base, mode: "quick" }).success).toBe(false);
        expect(submissionSchema.safeParse({ ...base, mode: "detailed", rounds: [] }).success).toBe(false);
        expect(submissionSchema.safeParse({ ...base, mode: "quick", freeText: "x", interviewYear: 2999 }).success).toBe(false);
    });
    it("applies defaults to the feed query", () => {
        expect(feedQuerySchema.parse({}).limit).toBe(20);
        expect(feedQuerySchema.parse({ year: "2026" }).year).toBe(2026);
    });
});
