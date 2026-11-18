/**
 * services/AdminOpsService.ts — ADMIN TOOLS THAT ARE NOT "APPROVE/REJECT"
 *
 * What it does (admins only):
 *   - the "Edits waiting" queue: approve or reject an author's edit to a live post;
 *   - the "Reports" queue: list reported posts, dismiss a report;
 *   - "Post on behalf of a student": an admin posts an experience for a student who agreed.
 *
 * System design:
 * - Single Responsibility: these admin operations are grouped here; status changes live in ModerationService.
 * - Defence in depth: guard() checks "are you an admin?" here, and every database function checks again.
 * - Fail fast: rejecting an edit without a reason is refused before touching the database.
 * - DRY (Don't Repeat Yourself): posting on behalf reuses SubmissionFactory, so an admin's post is shaped exactly
 *   like a student's (same rounds and questions logic).
 * - Dependency Inversion: depends only on three small interfaces (UpdateReviewWriter, ReportQueue, AdminPostWriter).
 */
import type { AdminPostDto, AdminReport, AdminUpdate } from "@preplens/shared";
import type { AdminPostWriter, ReportQueue, UpdateReviewWriter } from "../domain/ports.js";
import { ForbiddenError, ValidationError } from "../domain/errors.js";
import { SubmissionFactory } from "../domain/Submission.js";
import { isAdmin, type Viewer } from "../domain/viewer.js";

export class AdminOpsService {
  constructor(
    private readonly updates: UpdateReviewWriter,
    private readonly reports: ReportQueue,
    private readonly poster: AdminPostWriter,
    private readonly viewer: Viewer,
  ) {}

  /** Edits to live posts that are waiting for review. */
  async listUpdates(): Promise<AdminUpdate[]> { this.guard(); return this.updates.list(); }

  /** Approve an edit (it goes live) or reject it (a reason is required; the author sees it). */
  async decideUpdate(id: string, action: "approve" | "reject", note?: string): Promise<{ result: string }> {
    this.guard();
    if (action === "reject" && !note?.trim()) throw new ValidationError("A note is required when rejecting an update.", { note: "required" });
    return { result: await this.updates.decide(id, action === "approve", note?.trim()) };
  }

  /** Reports by status: open (new), actioned (post removed) or dismissed. */
  async listReports(status: "open" | "actioned" | "dismissed"): Promise<AdminReport[]> { this.guard(); return this.reports.list(status); }
  /** Close a report without removing the post. */
  async dismissReport(id: string): Promise<{ result: string }> { this.guard(); return { result: await this.reports.dismiss(id) }; }

  /**
   * Post for a student. Step 1: build the post with the SAME SubmissionFactory a student uses (quick or detailed).
   * Step 2: replace the student's own consent tick with the admin's fields: the student agreed, their name, batch,
   * branch and campus. The database refuses the post if "studentConsented" is not true.
   */
  async postOnBehalf(dto: AdminPostDto): Promise<{ id: string }> {
    this.guard();
    const { studentConsented, authorName, authorBatch, authorBranch, campus, ...rest } = dto;
    const base = SubmissionFactory.create({ ...rest, consent: true } as never).toPayload();
    const { consent: _drop, ...core } = base;
    void _drop;
    return { id: await this.poster.post({ ...core, studentConsented, authorName, authorBatch, authorBranch, campus } as never) };
  }

  /** "Are you an admin?" — second layer of the admin check (the route was the first, the database is the third). */
  private guard() {
    if (!isAdmin(this.viewer)) throw new ForbiddenError("Admins only.");
  }
}
