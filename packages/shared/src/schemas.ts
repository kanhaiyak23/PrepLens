import { z } from "zod";
import { BRANCHES, CAMPUSES, DRIVE_TYPES, EXPERIENCE_STATUSES, FEED_SORTS, MODERATION_ACTIONS, OUTCOMES, REPORT_REASONS } from "./enums.js";

/** Zod is the source of truth for request shapes (ADR-16). Parse once at the boundary, then trust the types. */

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const uuidParam = z.object({ id: z.string().uuid() });

export const feedQuerySchema = z.object({
  company: z.string().trim().min(1).max(80).optional(),
  role: z.string().trim().min(1).max(80).optional(),
  outcome: z.enum(OUTCOMES).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  campus: z.enum(CAMPUSES).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(FEED_SORTS).default("newest"),
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type FeedQuery = z.infer<typeof feedQuerySchema>;

const questionSchema = z.object({ text: text(2000), topic: optionalText(60) });
const roundSchema = z.object({
  name: text(120),
  tips: optionalText(4000),
  questions: z.array(questionSchema).max(30).default([]),
});

const thisYear = new Date().getUTCFullYear();
const interviewCore = {
  company: text(120),
  role: text(80),
  driveType: z.enum(DRIVE_TYPES),
  interviewYear: z.number().int().min(2000).max(thisYear),
  interviewMonth: z.number().int().min(1).max(12).optional(),
  outcome: z.enum(OUTCOMES),
  isAnonymous: z.boolean(),
};
const interviewBase = {
  ...interviewCore,
  // Literal true: anything else is invalid. Consent is not a default (ADR-18).
  consent: z.literal(true),
};

/**
 * Two ways to write the same thing. Both are normalised to rounds by the API (Template Method),
 * so the database only ever sees rounds. Fields such as userId, role, status and authorBatch are
 * deliberately absent: unknown keys are stripped, and the server derives identity from the token.
 */
export const submissionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("quick"), ...interviewBase, freeText: text(4000) }),
  z.object({ mode: z.literal("detailed"), ...interviewBase, rounds: z.array(roundSchema).min(1).max(12) }),
]);
export type SubmissionDto = z.infer<typeof submissionSchema>;

export const reportSchema = z.object({ reason: z.enum(REPORT_REASONS), note: optionalText(1000) });
export type ReportDto = z.infer<typeof reportSchema>;

export const moderationSchema = z.object({
  action: z.enum(MODERATION_ACTIONS),
  note: optionalText(1000),
});
export type ModerationDto = z.infer<typeof moderationSchema>;

export const profileUpdateSchema = z.object({
  fullName: text(120).optional(),
  graduationBatch: z.number().int().min(2000).max(2100).optional(),
  branch: z.enum(BRANCHES).optional(),
});
export type ProfileUpdateDto = z.infer<typeof profileUpdateSchema>;

export const moderationParams = z.object({ id: z.string().uuid(), action: z.enum(MODERATION_ACTIONS) });
export const moderationBody = z.object({ note: optionalText(1000) });

/** ?ids=a,b,c : at most 50 uuids. Keeps the per-user interaction call small and uncached (ADR-09). */
export const interactionsQuery = z.object({
  ids: z.string().transform((v) => v.split(",").map((x) => x.trim()).filter(Boolean)).pipe(z.array(z.string().uuid()).min(1).max(50)),
});

export const pageQuery = z.object({
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export const adminQueueQuery = pageQuery.extend({ status: z.enum(EXPERIENCE_STATUSES).default("pending") });
export const companyQuery = z.object({ prefix: z.string().trim().min(1).max(40).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });

export const slugParam = z.object({ slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/) });
export const companyDecisionParams = z.object({ slug: slugParam.shape.slug, action: z.enum(["approve", "merge"]) });
export const companyDecisionBody = z.object({ mergeInto: slugParam.shape.slug.optional() });

/** Edit or result update of the author's own post. At least one field. A live post queues it for review (see 02 ADR-15). */
export const experienceUpdateSchema = z
  .object({
    role: text(80).optional(),
    driveType: z.enum(DRIVE_TYPES).optional(),
    interviewYear: z.number().int().min(2000).max(thisYear).optional(),
    interviewMonth: z.number().int().min(1).max(12).nullable().optional(),
    outcome: z.enum(OUTCOMES).optional(),
    isAnonymous: z.boolean().optional(),
    rounds: z.array(roundSchema).min(1).max(12).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Change at least one field." });
export type ExperienceUpdateDto = z.infer<typeof experienceUpdateSchema>;

export const updateDecisionParams = z.object({ id: z.string().uuid(), action: z.enum(["approve", "reject"]) });
export const reportQueueQuery = z.object({ status: z.enum(["open", "actioned", "dismissed"]).default("open") });
export const accountDeletionQuery = z.object({ posts: z.enum(["keep", "delete"]) });

/** An admin posting for a student who has agreed. The student's name and batch are typed by the admin, so they are validated here and recorded as admin-supplied. */
const adminExtra = {
  studentConsented: z.literal(true),
  authorName: text(120),
  authorBatch: z.number().int().min(2000).max(2100),
  authorBranch: z.enum(BRANCHES),
  campus: z.enum(CAMPUSES).default("ru"),
};
export const adminPostSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("quick"), ...interviewCore, ...adminExtra, freeText: text(4000) }),
  z.object({ mode: z.literal("detailed"), ...interviewCore, ...adminExtra, rounds: z.array(roundSchema).min(1).max(12) }),
]);
export type AdminPostDto = z.infer<typeof adminPostSchema>;
