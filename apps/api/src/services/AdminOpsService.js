import { ForbiddenError, ValidationError } from "../domain/errors.js";
import { SubmissionFactory } from "../domain/Submission.js";
import { isAdmin } from "../domain/viewer.js";
/**
 * Admin-only operations that are not a status change: reviewing edits, the reports queue, posting for a student.
 * The role is checked here and again by every database function.
 */
export class AdminOpsService {
    updates;
    reports;
    poster;
    viewer;
    constructor(updates, reports, poster, viewer) {
        this.updates = updates;
        this.reports = reports;
        this.poster = poster;
        this.viewer = viewer;
    }
    async listUpdates() { this.guard(); return this.updates.list(); }
    async decideUpdate(id, action, note) {
        this.guard();
        if (action === "reject" && !note?.trim())
            throw new ValidationError("A note is required when rejecting an update.", { note: "required" });
        return { result: await this.updates.decide(id, action === "approve", note?.trim()) };
    }
    async listReports(status) { this.guard(); return this.reports.list(status); }
    async dismissReport(id) { this.guard(); return { result: await this.reports.dismiss(id) }; }
    /** Reuses the Submission normalisation so quick and detailed posts become rounds exactly as a student's would. */
    async postOnBehalf(dto) {
        this.guard();
        const { studentConsented, authorName, authorBatch, authorBranch, campus, ...rest } = dto;
        const base = SubmissionFactory.create({ ...rest, consent: true }).toPayload();
        const { consent: _drop, ...core } = base;
        void _drop;
        return { id: await this.poster.post({ ...core, studentConsented, authorName, authorBatch, authorBranch, campus }) };
    }
    guard() {
        if (!isAdmin(this.viewer))
            throw new ForbiddenError("Admins only.");
    }
}
