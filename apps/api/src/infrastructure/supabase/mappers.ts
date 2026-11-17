import type { AdminCard, BookmarkedCard, ExperienceCard, ExperienceDetail, MyExperience, PublicAuthor } from "@preplens/shared";
import { AuthorVisibilityFactory } from "../../domain/model/AuthorVisibility.js";

type Row = Record<string, unknown>;

const author = (raw: unknown): PublicAuthor => AuthorVisibilityFactory.fromDb(raw).toPublic();

/** Row from list_experiences() to the API shape. snake_case stops here. */
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

/** JSON from get_experience() to the API shape. */
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


export const toMine = (r: Row): MyExperience => ({
  id: r.id as string, companyName: r.company_name as string, role: r.role as string,
  outcome: r.outcome as MyExperience["outcome"], status: r.status as MyExperience["status"],
  reviewNote: (r.review_note as string) ?? null, interviewYear: r.interview_year as number,
  upvoteCount: r.upvote_count as number, roundCount: r.round_count as number, createdAt: r.created_at as string,
});

export const toAdminCard = (r: Row): AdminCard => ({
  ...toCard(r), status: r.status as AdminCard["status"], reviewNote: (r.review_note as string) ?? null, openReports: (r.open_reports as number) ?? 0,
});

export const toBookmarked = (r: Row): BookmarkedCard => ({ ...toCard(r), bookmarkedAt: r.bookmarked_at as string });
