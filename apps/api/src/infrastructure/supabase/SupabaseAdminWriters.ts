import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminReport, AdminUpdate, DeletionResult } from "@preplens/shared";
import type { AccountDeleter, AdminPostPayload, AdminPostWriter, ReportQueue, UpdateReviewWriter } from "../../domain/ports.js";
import { UpstreamError, fromDbError, fromDbMessage } from "../../domain/errors.js";

type Row = Record<string, unknown>;

export class SupabaseUpdateReviewWriter implements UpdateReviewWriter {
  constructor(private readonly db: SupabaseClient) {}
  async list(): Promise<AdminUpdate[]> {
    const { data, error } = await this.db.rpc("admin_list_updates");
    if (error) throw fromDbError(error);
    return ((data ?? []) as Row[]).map((r) => ({
      id: r.id as string, company: { name: r.company_name as string, slug: r.company_slug as string }, role: r.role as string,
      outcome: r.outcome as AdminUpdate["outcome"], interviewYear: r.interview_year as number,
      changes: (r.changes as Record<string, unknown>) ?? {}, submittedAt: r.submitted_at as string,
    }));
  }
  async decide(id: string, approve: boolean, note?: string): Promise<string> {
    const { data, error } = await this.db.rpc("admin_decide_update", { p_id: id, p_approve: approve, p_note: note ?? null });
    if (error) throw fromDbError(error);
    return data as string;
  }
}

export class SupabaseReportQueue implements ReportQueue {
  constructor(private readonly db: SupabaseClient) {}
  async list(status: "open" | "actioned" | "dismissed"): Promise<AdminReport[]> {
    const { data, error } = await this.db.rpc("admin_list_reports", { p_status: status });
    if (error) throw fromDbError(error);
    return ((data ?? []) as Row[]).map((r) => ({
      id: r.id as string, experienceId: r.experience_id as string, companyName: r.company_name as string, role: r.role as string,
      experienceStatus: r.experience_status as AdminReport["experienceStatus"], reason: r.reason as string, note: (r.note as string) ?? null,
      status: r.status as AdminReport["status"], createdAt: r.created_at as string,
    }));
  }
  async dismiss(id: string): Promise<string> {
    const { data, error } = await this.db.rpc("admin_dismiss_report", { p_id: id });
    if (error) throw fromDbError(error);
    return data as string;
  }
}

export class SupabaseAdminPostWriter implements AdminPostWriter {
  constructor(private readonly db: SupabaseClient) {}
  async post(p: AdminPostPayload): Promise<string> {
    const { data, error } = await this.db.rpc("admin_post_experience", { p_payload: p });
    if (error) throw fromDbError(error);
    return data as string;
  }
}

/** Service role. First the person's content (one transaction in SQL), then the auth user. The SQL step is idempotent, so a retry after a failure is safe. */
export class SupabaseAccountDeleter implements AccountDeleter {
  constructor(private readonly service: SupabaseClient) {}
  async delete(userId: string, keepLive: boolean): Promise<DeletionResult> {
    const { data, error } = await this.service.rpc("prepare_account_deletion", { p_user: userId, p_keep_live: keepLive });
    if (error) throw fromDbMessage(error.message) ?? new UpstreamError("Your account could not be prepared for deletion.");
    const { error: authError } = await this.service.auth.admin.deleteUser(userId);
    if (authError) throw new UpstreamError("Your content was handled but the account itself could not be removed. Please try again.");
    const d = data as { kept: number; deleted: number };
    return { kept: d.kept, deleted: d.deleted };
  }
}
