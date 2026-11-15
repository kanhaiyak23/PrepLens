import { toCard } from "./mappers.js";
export const toMine = (r) => ({
    id: r.id, companyName: r.company_name, role: r.role,
    outcome: r.outcome, status: r.status,
    reviewNote: r.review_note ?? null, interviewYear: r.interview_year,
    upvoteCount: r.upvote_count, roundCount: r.round_count, createdAt: r.created_at,
});
export const toAdminCard = (r) => ({
    ...toCard(r), status: r.status, reviewNote: r.review_note ?? null, openReports: r.open_reports ?? 0,
});
export const toBookmarked = (r) => ({ ...toCard(r), bookmarkedAt: r.bookmarked_at });
