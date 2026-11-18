/**
 * domain/ports.ts — THE "CONTRACTS" BETWEEN THE RULES AND THE DATABASE / AI
 *
 * What it does: lists interfaces (promises of "what can be done"), with no code inside. For example
 * "ModerationWriter can moderate(id, action, note)". Services use ONLY these interfaces. The real classes that talk
 * to Supabase or Gemini (in infrastructure/) implement them, and container.ts connects the two.
 *
 * System design:
 * - Ports and Adapters (Hexagonal Architecture, ADR-01): the core rules (services) don't know Supabase exists.
 *   "Ports" are these interfaces; "adapters" are the Supabase/Gemini classes that plug into them.
 *   Swapping the database or the AI means writing new adapters, not rewriting the rules.
 * - Dependency Inversion (D in SOLID): high-level code (services) depends on abstractions (these interfaces),
 *   not on low-level details (Supabase).
 * - Interface Segregation (I in SOLID): many small interfaces instead of one giant "Repository". A reader has no
 *   write methods; the moderation writer can only moderate. Misuse doesn't even compile.
 * - Testability: tests give services in-memory fakes that implement the same interfaces, so no database is needed.
 *   A test (ports.test.ts) checks every real adapter implements every method of its interface.
 */
import type {
  AdminCard, BookmarkedCard, CompanySummary, ExperienceCard, ExperienceDetail, ExperienceStatus, FeedQuery,
  FeedSortName, InteractionState, MeResponse, ModerationAction, MyExperience, ProfileUpdateDto, ReportReason,
} from "@preplens/shared";
import type { Viewer } from "./viewer.js";
import type { FeedAfter } from "./model/FeedSort.js";

/** A keyset-paging position: "after the item created at `at` with this `id`". */
export type Keyset = { at: string; id: string };

// =============================================================== READERS (read-only)

/** Reads the public feed and single posts. */
export interface ExperienceReader {
  findPage(q: Omit<FeedQuery, "cursor" | "limit" | "sort"> & { sort: FeedSortName; after?: FeedAfter; limit: number }): Promise<ExperienceCard[]>;
  findById(id: string): Promise<ExperienceDetail | null>;
}

/** Reads MY posts and MY saved posts. */
export interface MyContentReader {
  listMine(): Promise<MyExperience[]>;
  listBookmarks(q: { after?: Keyset; limit: number }): Promise<BookmarkedCard[]>;
}

/** Reads the admin review queue for a status. */
export interface AdminQueueReader {
  list(q: { status: ExperienceStatus; after?: Keyset; limit: number }): Promise<AdminCard[]>;
}

/** Reads the company list. */
export interface CompanyReader {
  list(q: { prefix?: string; limit: number }): Promise<CompanySummary[]>;
}

/** The shape a new post is saved in. Always a list of rounds: quick and detailed forms are both turned into this. */
export type RoundPayload = { name: string; tips?: string; questions: { text: string; topic?: string }[] };
export type SubmitPayload = {
  company: string; role: string; driveType: string; interviewYear: number; interviewMonth?: number;
  outcome: string; isAnonymous: boolean; consent: true; rounds: RoundPayload[];
};

// =============================================================== WRITERS (change data)

/** Saves posts and the author's own changes. */
export interface ExperienceWriter {
  /** Save a new post; returns its id. */
  submit(p: SubmitPayload): Promise<string>;
  /** Unpublish (false) or republish (true); returns the new status. */
  setVisibility(id: string, publish: boolean): Promise<ExperienceStatus>;
  /** Edit a post. A live post's edit is queued for review ("queued"); any other post is edited now ("applied"). */
  update(id: string, changes: Record<string, unknown>): Promise<"applied" | "queued">;
  /** Withdraw a queued edit. */
  cancelUpdate(id: string): Promise<void>;
}

/** Votes and bookmarks (idempotent: setting the same state twice changes nothing). */
export interface InteractionWriter {
  setVote(id: string, on: boolean): Promise<{ voted: boolean; upvoteCount: number }>;
  setBookmark(id: string, on: boolean): Promise<{ bookmarked: boolean }>;
  interactions(ids: string[]): Promise<InteractionState>;
}

/** Files a report on a post; returns the report id. */
export interface ReportWriter {
  report(id: string, reason: ReportReason, note?: string): Promise<string>;
}

/** Admin decisions on a post. Its ONLY method is a decision, and the database logs every one (append-only audit). */
export interface ModerationWriter {
  moderate(id: string, action: ModerationAction, note?: string): Promise<ExperienceStatus>;
}

/** Reads my profile. */
export interface ProfileReader {
  getMe(): Promise<MeResponse | null>;
}
/** Updates my profile. (Reads and writes are split: Interface Segregation.) */
export interface ProfileWriter {
  update(dto: ProfileUpdateDto): Promise<MeResponse>;
}

// =============================================================== CROSS-CUTTING SERVICES

/** Counts requests per user and action. */
export interface RateLimiter {
  /** Returns true if this call is still within the limit. Atomic, and shared by every server copy (ADR-11). */
  consume(key: string, action: string, limit: number, windowSeconds: number): Promise<boolean>;
}

/** What we learn from a valid login token. */
export type VerifiedToken = { userId: string; email: string };

/** Checks login tokens. */
export interface TokenVerifier {
  /** Throws AuthenticationError if the token is missing, malformed, expired, or not from our project. */
  verify(token: string): Promise<VerifiedToken>;
}

/** Every reader and writer one request may need, built for the person calling (so database security rules apply). */
export interface ScopedRepositories {
  experiences: ExperienceReader;
  mine: MyContentReader;
  adminQueue: AdminQueueReader;
  companies: CompanyReader;
  experienceWriter: ExperienceWriter;
  interactions: InteractionWriter;
  reports: ReportWriter;
  moderation: ModerationWriter;
  profiles: ProfileReader;
  profileWriter: ProfileWriter;
  guideSources: GuideSourceReader;
  companyAdmin: CompanyAdminWriter;
  updateReview: UpdateReviewWriter;
  reportQueue: ReportQueue;
  adminPost: AdminPostWriter;
  adminRoles: AdminRoleWriter;
}

/** Factory pattern: builds all of the above for one viewer. */
export interface RepositoryFactory {
  /** Repositories that run AS the caller (so database security rules apply), or as an anonymous reader for visitors. */
  for(viewer: Viewer): ScopedRepositories;
}

import type { CompanyGuide, CompanySources } from "./guide/CompanyGuide.js";
import type { AdminMember, PendingCompany } from "@preplens/shared";

// =============================================================== AI GUIDE

/** What we send to the AI: instructions, the prompt, and the JSON shape we require back. */
export type LlmRequest = { system: string; prompt: string; schema: unknown };
/** What comes back: the parsed JSON and which model produced it. */
export type LlmResult = { data: unknown; model: string };

/** Any AI model. GeminiClient and the FallbackLlmClient wrapper both implement it (Liskov: either can be used). */
export interface LlmClient {
  generateJson(req: LlmRequest): Promise<LlmResult>;
}

/** Reads a company's published posts for the AI. */
export interface GuideSourceReader {
  forCompany(slug: string): Promise<CompanySources | null>;
}

/** The saved (cached) AI guides. The cache belongs to the system, so this one uses the server's service key. */
export interface GuideRepository {
  find(companyId: string): Promise<CompanyGuide | null>;
  save(guide: CompanyGuide): Promise<void>;
}

// =============================================================== ADMIN

/** Approve or merge new company names. */
export interface CompanyAdminWriter {
  listPending(): Promise<PendingCompany[]>;
  decide(slug: string, action: "approve" | "merge", mergeInto?: string): Promise<string>;
}

import type { AdminReport, AdminUpdate, DeletionResult } from "@preplens/shared";

/** The "edits waiting" queue. */
export interface UpdateReviewWriter {
  list(): Promise<AdminUpdate[]>;
  decide(id: string, approve: boolean, note?: string): Promise<string>;
}
/** The reports queue. */
export interface ReportQueue {
  list(status: "open" | "actioned" | "dismissed"): Promise<AdminReport[]>;
  dismiss(id: string): Promise<string>;
}
/** A post made by an admin for a student: the normal post, minus the student's own consent tick, plus the student's details and consent. */
export type AdminPostPayload = SubmitPayload extends infer P ? Omit<P & object, "consent"> & { studentConsented: true; authorName: string; authorBatch: number; authorBranch: string; campus: string } : never;
/** Saves a post made on a student's behalf. */
export interface AdminPostWriter {
  post(p: AdminPostPayload): Promise<string>;
}
/**
 * Admin role management (ADR-31). The database enforces every rule (admins only, no self-removal, never zero admins,
 * one change at a time, every change logged); the service checks the obvious ones first for a fast, clear answer.
 * Runs as the caller, so the database's own admin check applies.
 */
export type AdminAccount = Omit<AdminMember, "isSelf">;
export interface AdminRoleWriter {
  list(): Promise<AdminAccount[]>;
  grant(email: string): Promise<AdminAccount>;
  revoke(userId: string): Promise<AdminAccount>;
}

/** Deletes a user's account and content. Uses the server's service key, because deleting a login needs system rights. */
export interface AccountDeleter {
  delete(userId: string, keepLive: boolean): Promise<DeletionResult>;
}
