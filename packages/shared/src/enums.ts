/** One vocabulary for the whole system (web, API, database). Must match the CHECK constraints in supabase/migrations. */
export const OUTCOMES = ["selected", "rejected", "in-process", "withdrew"] as const;
export const DRIVE_TYPES = ["on-campus", "off-campus", "referral"] as const;
export const CAMPUSES = ["ru", "bangalore", "hyderabad", "pune"] as const;
export const BRANCHES = ["CSE", "CSE-AI", "CSE-DS", "ECE", "Other"] as const;
export const EXPERIENCE_STATUSES = ["pending", "published", "rejected", "unpublished", "removed"] as const;
export const REPORT_REASONS = ["interviewer-named", "confidential", "false", "abusive", "other"] as const;
export const MODERATION_ACTIONS = ["approve", "reject", "remove", "reinstate"] as const;
export const ROLES = ["student", "admin"] as const;
export const FEED_SORTS = ["newest", "interview"] as const;
/** What a viewer may do to one experience, computed by the lifecycle state machine (see apps/api domain/model). */
export const EXPERIENCE_ACTIONS = ["edit", "withdraw", "republish", "cancel-update", "approve", "reject", "remove", "reinstate"] as const;

/** Stable error codes (ADR-19). The API and the database use the same names. */
export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "NOT_ENOUGH_DATA",
  "UPSTREAM_UNAVAILABLE",
  "INTERNAL",
] as const;

export type Outcome = (typeof OUTCOMES)[number];
export type DriveType = (typeof DRIVE_TYPES)[number];
export type Campus = (typeof CAMPUSES)[number];
export type Branch = (typeof BRANCHES)[number];
export type ExperienceStatus = (typeof EXPERIENCE_STATUSES)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];
export type Role = (typeof ROLES)[number];
export type FeedSortName = (typeof FEED_SORTS)[number];
export type ExperienceAction = (typeof EXPERIENCE_ACTIONS)[number];
export type ErrorCode = (typeof ERROR_CODES)[number];
