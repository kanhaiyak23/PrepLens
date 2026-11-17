import type {
  AdminCard, BookmarkedCard, CompanySummary, ExperienceCard, ExperienceDetail, ExperienceStatus, FeedQuery,
  FeedSortName, InteractionState, MeResponse, ModerationAction, MyExperience, ProfileUpdateDto, ReportReason,
} from "@preplens/shared";
import type { Viewer } from "./viewer.js";
import type { FeedAfter } from "./model/FeedSort.js";

/**
 * Ports (ADR-01, ADR-23). Services depend on these interfaces and never on Supabase.
 * They are split by purpose (Interface Segregation): a reader has no write methods, and the moderation
 * writer has no other methods, so misuse does not compile.
 */
export type Keyset = { at: string; id: string };

export interface ExperienceReader {
  findPage(q: Omit<FeedQuery, "cursor" | "limit" | "sort"> & { sort: FeedSortName; after?: FeedAfter; limit: number }): Promise<ExperienceCard[]>;
  findById(id: string): Promise<ExperienceDetail | null>;
}

export interface MyContentReader {
  listMine(): Promise<MyExperience[]>;
  listBookmarks(q: { after?: Keyset; limit: number }): Promise<BookmarkedCard[]>;
}

export interface AdminQueueReader {
  list(q: { status: ExperienceStatus; after?: Keyset; limit: number }): Promise<AdminCard[]>;
}

export interface CompanyReader {
  list(q: { prefix?: string; limit: number }): Promise<CompanySummary[]>;
}

/** The shape the database function expects. Always rounds: quick and detailed forms are normalised before this point. */
export type RoundPayload = { name: string; tips?: string; questions: { text: string; topic?: string }[] };
export type SubmitPayload = {
  company: string; role: string; driveType: string; interviewYear: number; interviewMonth?: number;
  outcome: string; isAnonymous: boolean; consent: true; rounds: RoundPayload[];
};

export interface ExperienceWriter {
  submit(p: SubmitPayload): Promise<string>;
  setVisibility(id: string, publish: boolean): Promise<ExperienceStatus>;
  /** A live post queues the change for review; any other post is edited directly. */
  update(id: string, changes: Record<string, unknown>): Promise<"applied" | "queued">;
  cancelUpdate(id: string): Promise<void>;
}

export interface InteractionWriter {
  setVote(id: string, on: boolean): Promise<{ voted: boolean; upvoteCount: number }>;
  setBookmark(id: string, on: boolean): Promise<{ bookmarked: boolean }>;
  interactions(ids: string[]): Promise<InteractionState>;
}

export interface ReportWriter {
  report(id: string, reason: ReportReason, note?: string): Promise<string>;
}

/** Append-only by construction: the only method is a decision, and the database logs it. */
export interface ModerationWriter {
  moderate(id: string, action: ModerationAction, note?: string): Promise<ExperienceStatus>;
}

export interface ProfileReader {
  getMe(): Promise<MeResponse | null>;
}
export interface ProfileWriter {
  update(dto: ProfileUpdateDto): Promise<MeResponse>;
}

export interface RateLimiter {
  /** Returns true when the call is within the limit. Atomic and shared across instances (ADR-11). */
  consume(key: string, action: string, limit: number, windowSeconds: number): Promise<boolean>;
}

export type VerifiedToken = { userId: string; email: string };

export interface TokenVerifier {
  /** Throws AuthenticationError when the token is missing, malformed, expired or not signed by our project. */
  verify(token: string): Promise<VerifiedToken>;
}

/** Everything a request-scoped service may need, built once per request from the caller's token. */
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

export interface RepositoryFactory {
  /** Repositories that run as the caller (RLS applies), or as an anonymous reader. */
  for(viewer: Viewer): ScopedRepositories;
}

import type { CompanyGuide, CompanySources } from "./guide/CompanyGuide.js";
import type { AdminMember, PendingCompany } from "@preplens/shared";

export type LlmRequest = { system: string; prompt: string; schema: unknown };
export type LlmResult = { data: unknown; model: string };

/** Port for the language model. The Gemini adapter and the fallback decorator both implement it (Liskov: both return parsed JSON or throw). */
export interface LlmClient {
  generateJson(req: LlmRequest): Promise<LlmResult>;
}

export interface GuideSourceReader {
  forCompany(slug: string): Promise<CompanySources | null>;
}

/** The guide cache is system-owned, so this repository uses the service role (docs/design/08 section 8.6). */
export interface GuideRepository {
  find(companyId: string): Promise<CompanyGuide | null>;
  save(guide: CompanyGuide): Promise<void>;
}

export interface CompanyAdminWriter {
  listPending(): Promise<PendingCompany[]>;
  decide(slug: string, action: "approve" | "merge", mergeInto?: string): Promise<string>;
}

import type { AdminReport, AdminUpdate, DeletionResult } from "@preplens/shared";

export interface UpdateReviewWriter {
  list(): Promise<AdminUpdate[]>;
  decide(id: string, approve: boolean, note?: string): Promise<string>;
}
export interface ReportQueue {
  list(status: "open" | "actioned" | "dismissed"): Promise<AdminReport[]>;
  dismiss(id: string): Promise<string>;
}
export type AdminPostPayload = SubmitPayload extends infer P ? Omit<P & object, "consent"> & { studentConsented: true; authorName: string; authorBatch: number; authorBranch: string; campus: string } : never;
export interface AdminPostWriter {
  post(p: AdminPostPayload): Promise<string>;
}
/** Service-role port: removes the person's content, then the auth user (docs/design/08 section 8.6). */
/**
 * Admin role management (ADR-31). The database enforces every rule (admins only, no self-removal, never zero admins,
 * serialised changes, logged); the service fails fast on the obvious ones. Runs as the caller, so RLS and is_admin() apply.
 */
export type AdminAccount = Omit<AdminMember, "isSelf">;
export interface AdminRoleWriter {
  list(): Promise<AdminAccount[]>;
  grant(email: string): Promise<AdminAccount>;
  revoke(userId: string): Promise<AdminAccount>;
}

export interface AccountDeleter {
  delete(userId: string, keepLive: boolean): Promise<DeletionResult>;
}
