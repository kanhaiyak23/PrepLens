import type { Branch, Campus, DriveType, ErrorCode, ExperienceAction, ExperienceStatus, Outcome, Role } from "./enums.js";

/** What a client is allowed to see of an author. Anonymous posts carry the batch only (ADR-06). */
export type PublicAuthor =
  | { anonymous: true; batch: number | null }
  | { anonymous: false; name: string | null; batch: number | null; branch: Branch | null };

export type ExperienceCard = {
  id: string;
  company: { name: string; slug: string };
  role: string;
  driveType: DriveType;
  interviewYear: number;
  interviewMonth: number | null;
  outcome: Outcome;
  campus: Campus;
  roundCount: number;
  upvoteCount: number;
  createdAt: string;
  updatedAt: string | null;
  author: PublicAuthor;
};

export type Round = {
  position: number;
  name: string;
  tips: string | null;
  questions: { text: string; topic: string | null }[];
};

export type ExperienceDetail = Omit<ExperienceCard, "roundCount"> & {
  rounds: Round[];
  /** Present only when the viewer is the author or an admin. */
  status?: ExperienceStatus;
  reviewNote?: string | null;
  isOwner?: boolean;
  /** What this viewer may do next, from the lifecycle state machine. Present only in the privileged view. */
  allowedActions?: ExperienceAction[];
  isAnonymous?: boolean;
  /** The author's change waiting for review. Visible to the author and admins only. */
  pendingUpdate?: Record<string, unknown> | null;
  updateReviewNote?: string | null;
};

export type Page<T> = { data: T[]; page: { nextCursor: string | null; hasMore: boolean } };

export type MeResponse = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  graduationBatch: number | null;
  branch: Branch | null;
  role: Role;
  profileComplete: boolean;
};

export type ApiErrorBody = {
  error: { code: ErrorCode; message: string; fields?: Record<string, string> };
  requestId: string;
};

export type SubmitResult = { id: string; status: "pending" };
export type VisibilityResult = { status: ExperienceStatus };
export type VoteResult = { voted: boolean; upvoteCount: number };
export type BookmarkResult = { bookmarked: boolean };
export type InteractionState = { voted: string[]; bookmarked: string[] };
export type ReportResult = { id: string };
export type ModerationResult = { status: ExperienceStatus };

export type MyExperience = {
  id: string; companyName: string; role: string; outcome: Outcome; status: ExperienceStatus;
  reviewNote: string | null; interviewYear: number; upvoteCount: number; roundCount: number; createdAt: string;
};
export type AdminCard = ExperienceCard & { status: ExperienceStatus; reviewNote: string | null; openReports: number };
export type BookmarkedCard = ExperienceCard & { bookmarkedAt: string };
export type CompanySummary = { name: string; slug: string; experienceCount: number };

export type PendingCompany = { name: string; slug: string; createdAt: string; postCount: number };

export type GuideSource = { n: number; id: string; role: string; interviewYear: number; outcome: Outcome; author: PublicAuthor };
export type GuideView = {
  company: { name: string; slug: string };
  generatedAt: string;
  /** True when the guide could not be refreshed and an older (still fully published) version is shown. */
  stale: boolean;
  /** Counted from the posts in code, never written by the model. */
  stats: { experienceCount: number; outcomes: Record<string, number>; topTopics: { name: string; count: number }[] };
  overview: string;
  rounds: { name: string; focus: string; sources: number[] }[];
  tips: { text: string; sources: number[] }[];
  sources: GuideSource[];
};

export type UpdateResult = { result: "applied" | "queued" };
export type AdminUpdate = { id: string; company: { name: string; slug: string }; role: string; outcome: Outcome; interviewYear: number; changes: Record<string, unknown>; submittedAt: string };
export type AdminReport = { id: string; experienceId: string; companyName: string; role: string; experienceStatus: ExperienceStatus; reason: string; note: string | null; status: "open" | "actioned" | "dismissed"; createdAt: string };
export type DeletionResult = { kept: number; deleted: number };
/** A current admin. `isSelf` marks the caller, whose own access cannot be removed (ADR-31). */
export type AdminMember = { id: string; email: string; fullName: string; joinedAt: string; isSelf: boolean };
