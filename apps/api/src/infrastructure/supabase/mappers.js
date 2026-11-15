import { AuthorVisibilityFactory } from "../../domain/model/AuthorVisibility.js";
const author = (raw) => AuthorVisibilityFactory.fromDb(raw).toPublic();
/** Row from list_experiences() to the API shape. snake_case stops here. */
export function toCard(r) {
    return {
        id: r.id,
        company: { name: r.company_name, slug: r.company_slug },
        role: r.role,
        driveType: r.drive_type,
        interviewYear: r.interview_year,
        interviewMonth: r.interview_month ?? null,
        outcome: r.outcome,
        campus: r.campus,
        roundCount: r.round_count,
        upvoteCount: r.upvote_count,
        createdAt: r.created_at,
        updatedAt: r.updated_at && Date.parse(r.updated_at) > Date.parse(r.created_at) ? r.updated_at : null,
        author: author(r.author),
    };
}
/** JSON from get_experience() to the API shape. */
export function toDetail(j) {
    const company = j.company;
    const rounds = j.rounds ?? [];
    const detail = {
        id: j.id,
        company,
        role: j.role,
        driveType: j.drive_type,
        interviewYear: j.interview_year,
        interviewMonth: j.interview_month ?? null,
        outcome: j.outcome,
        campus: j.campus,
        upvoteCount: j.upvote_count,
        createdAt: j.created_at,
        updatedAt: j.updated_at ?? null,
        author: author(j.author),
        rounds: rounds.map((r) => ({
            position: r.position,
            name: r.name,
            tips: r.tips ?? null,
            questions: (r.questions ?? []).map((q) => ({ text: q.text, topic: q.topic ?? null })),
        })),
    };
    if (j.status !== undefined) {
        detail.status = j.status;
        detail.reviewNote = j.review_note ?? null;
        detail.isOwner = Boolean(j.is_owner);
        detail.isAnonymous = Boolean(j.is_anonymous);
        detail.pendingUpdate = j.pending_update ?? null;
        detail.updateReviewNote = j.update_review_note ?? null;
    }
    return detail;
}
