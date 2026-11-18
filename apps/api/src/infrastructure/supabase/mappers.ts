/**
 * infrastructure/supabase/mappers.ts — TRANSLATES DATABASE ROWS INTO API SHAPES
 *
 * What it does: the database uses snake_case names (company_name, interview_year); the API uses camelCase
 * (companyName, interviewYear) and nested objects. These small functions convert one into the other:
 *   toCard (feed card), toDetail (one full post), toMine (my post), toAdminCard (review queue), toBookmarked (saved post).
 *
 * System design:
 * - Data Mapper: the database's naming stops here; nothing above this layer ever sees a database column name.
 *   If a column is renamed, only this file changes.
 * - Privacy gate: every author goes through AuthorVisibility, so an anonymous author can only ever come out as
 *   "anonymous + batch", whatever the row contains.
 * - Reuse (DRY): toAdminCard and toBookmarked build on toCard and add only their extra fields.
 */
import type { AdminCard, BookmarkedCard, ExperienceCard, ExperienceDetail, MyExperience, PublicAuthor } from "@preplens/shared";
import { AuthorVisibilityFactory } from "../../domain/model/AuthorVisibility.js";

type Row = Record<string, unknown>;

/** Every author passes through the privacy gate (anonymous -> only batch is shown). */
const author = (raw: unknown): PublicAuthor => AuthorVisibilityFactory.fromDb(raw).toPublic();

/** A feed card (from list_experiences). "updatedAt" is only set if the post really was edited after it was created. */
export function toCard(r: Row): ExperienceCard {
  return {
    id: r.id as string,
    company: { name: r.company_name as string, slug: r.company_slug as string },
    role: r.role as string,
    driveType: r.drive_type as ExperienceCard["driveType"],
    interviewYear: r.interview_year as number,
    interviewMonth: (r.interview_month as number) ?? null,
    outcome: r.outcome as ExperienceCard["outcome"],
    campus: r.campus as ExperienceCard["campus"],
    roundCount: r.round_count as number,
    upvoteCount: r.upvote_count as number,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at && Date.parse(r.updated_at as string) > Date.parse(r.created_at as string) ? (r.updated_at as string) : null,
    author: author(r.author),
  };
}

/** One full post with its rounds and questions (from get_experience). */
export function toDetail(j: Row): ExperienceDetail {
  const company = j.company as { name: string; slug: string };
  const rounds = (j.rounds as Row[]) ?? [];
  const detail: ExperienceDetail = {
    id: j.id as string,
    company,
    role: j.role as string,
    driveType: j.drive_type as ExperienceDetail["driveType"],
    interviewYear: j.interview_year as number,
    interviewMonth: (j.interview_month as number) ?? null,
    outcome: j.outcome as ExperienceDetail["outcome"],
    campus: j.campus as ExperienceDetail["campus"],
    upvoteCount: j.upvote_count as number,
    createdAt: j.created_at as string,
    updatedAt: (j.updated_at as string) ?? null,
    author: author(j.author),
    rounds: rounds.map((r) => ({
      position: r.position as number,
      name: r.name as string,
      tips: (r.tips as string) ?? null,
      questions: ((r.questions as Row[]) ?? []).map((q) => ({ text: q.text as string, topic: (q.topic as string) ?? null })),
    })),
  };
  // Extra fields that the database sends ONLY to the post's author or an admin (status, review note, pending edit...).
  if (j.status !== undefined) {
    detail.status = j.status as ExperienceDetail["status"];
    detail.reviewNote = (j.review_note as string) ?? null;
    detail.isOwner = Boolean(j.is_owner);
    detail.isAnonymous = Boolean(j.is_anonymous);
    detail.pendingUpdate = (j.pending_update as Record<string, unknown>) ?? null;
    detail.updateReviewNote = (j.update_review_note as string) ?? null;
  }
  return detail;
}

/** One of my own posts, with its status and any rejection reason. */
export const toMine = (r: Row): MyExperience => ({
  id: r.id as string, companyName: r.company_name as string, role: r.role as string,
  outcome: r.outcome as MyExperience["outcome"], status: r.status as MyExperience["status"],
  reviewNote: (r.review_note as string) ?? null, interviewYear: r.interview_year as number,
  upvoteCount: r.upvote_count as number, roundCount: r.round_count as number, createdAt: r.created_at as string,
});

/** A card in the admin queue: a normal card + status, review note and number of open reports. */
export const toAdminCard = (r: Row): AdminCard => ({
  ...toCard(r), status: r.status as AdminCard["status"], reviewNote: (r.review_note as string) ?? null, openReports: (r.open_reports as number) ?? 0,
});

/** A saved post: a normal card + when I saved it. */
export const toBookmarked = (r: Row): BookmarkedCard => ({ ...toCard(r), bookmarkedAt: r.bookmarked_at as string });
