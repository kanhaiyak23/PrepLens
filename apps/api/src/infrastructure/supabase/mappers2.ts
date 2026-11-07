import type { AdminCard, BookmarkedCard, MyExperience } from "@preplens/shared";
import { toCard } from "./mappers.js";

type Row = Record<string, unknown>;

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
