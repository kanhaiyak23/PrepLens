import { UpstreamError, fromDbError, fromDbMessage } from "../../domain/errors.js";
export class SupabaseUpdateReviewWriter {
    db;
    constructor(db) {
        this.db = db;
    }
    async list() {
        const { data, error } = await this.db.rpc("admin_list_updates");
        if (error)
            throw fromDbError(error);
        return (data ?? []).map((r) => ({
            id: r.id, company: { name: r.company_name, slug: r.company_slug }, role: r.role,
            outcome: r.outcome, interviewYear: r.interview_year,
            changes: r.changes ?? {}, submittedAt: r.submitted_at,
        }));
    }
    async decide(id, approve, note) {
        const { data, error } = await this.db.rpc("admin_decide_update", { p_id: id, p_approve: approve, p_note: note ?? null });
        if (error)
            throw fromDbError(error);
        return data;
    }
}
export class SupabaseReportQueue {
    db;
    constructor(db) {
        this.db = db;
    }
    async list(status) {
        const { data, error } = await this.db.rpc("admin_list_reports", { p_status: status });
        if (error)
            throw fromDbError(error);
        return (data ?? []).map((r) => ({
            id: r.id, experienceId: r.experience_id, companyName: r.company_name, role: r.role,
            experienceStatus: r.experience_status, reason: r.reason, note: r.note ?? null,
            status: r.status, createdAt: r.created_at,
        }));
    }
    async dismiss(id) {
        const { data, error } = await this.db.rpc("admin_dismiss_report", { p_id: id });
        if (error)
            throw fromDbError(error);
        return data;
    }
}
export class SupabaseAdminPostWriter {
    db;
    constructor(db) {
        this.db = db;
    }
    async post(p) {
        const { data, error } = await this.db.rpc("admin_post_experience", { p_payload: p });
        if (error)
            throw fromDbError(error);
        return data;
    }
}
/** Service role. First the person's content (one transaction in SQL), then the auth user. The SQL step is idempotent, so a retry after a failure is safe. */
export class SupabaseAccountDeleter {
    service;
    constructor(service) {
        this.service = service;
    }
    async delete(userId, keepLive) {
        const { data, error } = await this.service.rpc("prepare_account_deletion", { p_user: userId, p_keep_live: keepLive });
        if (error)
            throw fromDbMessage(error.message) ?? new UpstreamError("Your account could not be prepared for deletion.");
        const { error: authError } = await this.service.auth.admin.deleteUser(userId);
        if (authError)
            throw new UpstreamError("Your content was handled but the account itself could not be removed. Please try again.");
        const d = data;
        return { kept: d.kept, deleted: d.deleted };
    }
}
