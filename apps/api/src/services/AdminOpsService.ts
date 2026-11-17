import type { AdminPostDto, AdminReport, AdminUpdate } from "@preplens/shared";
import type { AdminPostWriter, ReportQueue, UpdateReviewWriter } from "../domain/ports.js";
import { ForbiddenError, ValidationError } from "../domain/errors.js";
import { SubmissionFactory } from "../domain/Submission.js";
import { isAdmin, type Viewer } from "../domain/viewer.js";

/**
 * Admin-only operations that are not a status change: reviewing edits, the reports queue, posting for a student.
 * The role is checked here and again by every database function.
 */
export class AdminOpsService {
  constructor(
    private readonly updates: UpdateReviewWriter,
    private readonly reports: ReportQueue,
    private readonly poster: AdminPostWriter,
    private readonly viewer: Viewer,
  ) {}

  async listUpdates(): Promise<AdminUpdate[]> { this.guard(); return this.updates.list(); }

  async decideUpdate(id: string, action: "approve" | "reject", note?: string): Promise<{ result: string }> {
    this.guard();
    if (action === "reject" && !note?.trim()) throw new ValidationError("A note is required when rejecting an update.", { note: "required" });
    return { result: await this.updates.decide(id, action === "approve", note?.trim()) };
  }

  async listReports(status: "open" | "actioned" | "dismissed"): Promise<AdminReport[]> { this.guard(); return this.reports.list(status); }
  async dismissReport(id: string): Promise<{ result: string }> { this.guard(); return { result: await this.reports.dismiss(id) }; }

  /** Reuses the Submission normalisation so quick and detailed posts become rounds exactly as a student's would. */
  async postOnBehalf(dto: AdminPostDto): Promise<{ id: string }> {
    this.guard();
    const { studentConsented, authorName, authorBatch, authorBranch, campus, ...rest } = dto;
    const base = SubmissionFactory.create({ ...rest, consent: true } as never).toPayload();
    const { consent: _drop, ...core } = base;
    void _drop;
    return { id: await this.poster.post({ ...core, studentConsented, authorName, authorBatch, authorBranch, campus } as never) };
  }

  private guard() {
    if (!isAdmin(this.viewer)) throw new ForbiddenError("Admins only.");
  }
}
