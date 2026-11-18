/**
 * infrastructure/supabase/SupabaseAdminWriters.ts — DATABASE CALLS FOR ADMIN TOOLS AND ACCOUNT DELETION
 *
 * What it does:
 *   - SupabaseUpdateReviewWriter: list edits waiting for review; approve or reject one.
 *   - SupabaseReportQueue: list reports by status; dismiss one.
 *   - SupabaseAdminPostWriter: save a post made on a student's behalf.
 *   - SupabaseAccountDeleter: delete a user's content and then their login (uses the server's service key).
 *   - SupabaseAdminRoleWriter: list admins, make someone admin, remove admin access.
 *
 * System design:
 * - Repository + Adapter: each class implements one small interface from ports.ts and hides the SQL.
 * - Defence in depth: every admin database function checks "is the caller an admin?" again (third check),
 *   and writes to the append-only moderation log.
 * - Least privilege: everything runs as the calling admin, EXCEPT account deletion, which needs the service key
 *   because deleting a login is a system operation.
 * - Idempotent, retry-safe deletion: the content step can safely run twice, so if removing the login fails,
 *   the user can simply try again.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminReport, AdminUpdate, DeletionResult } from "@preplens/shared";
import type { AccountDeleter, AdminAccount, AdminPostPayload, AdminPostWriter, AdminRoleWriter, ReportQueue, UpdateReviewWriter } from "../../domain/ports.js";
import { UpstreamError, fromDbError, fromDbMessage } from "../../domain/errors.js";

type Row = Record<string, unknown>;

/** The "Edits waiting" queue. */
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
  /** Approve (apply the edit) or reject (keep the old version, store the reason). Logged by the database. */
  async decide(id: string, approve: boolean, note?: string): Promise<string> {
    const { data, error } = await this.db.rpc("admin_decide_update", { p_id: id, p_approve: approve, p_note: note ?? null });
    if (error) throw fromDbError(error);
    return data as string;
  }
}

/** The "Reports" queue. */
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

/** Saves a post made for a student. The database refuses it without the student's consent. */
export class SupabaseAdminPostWriter implements AdminPostWriter {
  constructor(private readonly db: SupabaseClient) {}
  async post(p: AdminPostPayload): Promise<string> {
    const { data, error } = await this.db.rpc("admin_post_experience", { p_payload: p });
    if (error) throw fromDbError(error);
    return data as string;
  }
}

/**
 * Deletes an account in two steps (uses the service key):
 *   1. handle the person's content in ONE database transaction (keep live posts as anonymous, or delete them);
 *   2. delete their login from Supabase Auth.
 * Step 1 is safe to repeat, so if step 2 fails, a retry finishes the job.
 */
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

/** Database row -> admin entry for the API. */
const toAdminAccount = (r: Row): AdminAccount => ({
  id: r.id as string, email: r.email as string, fullName: r.full_name as string, joinedAt: r.created_at as string,
});

/**
 * Admin roles (ADR-31). Each call is one database function that, in one transaction: checks the caller is an admin,
 * takes a lock so only one role change runs at a time, refuses self-removal and removing the last admin,
 * changes the role and writes the moderation log.
 */
export class SupabaseAdminRoleWriter implements AdminRoleWriter {
  constructor(private readonly db: SupabaseClient) {}

  async list(): Promise<AdminAccount[]> {
    const { data, error } = await this.db.rpc("admin_list_admins");
    if (error) throw fromDbError(error);
    return ((data ?? []) as Row[]).map(toAdminAccount);
  }

  /** By email, because an admin knows a classmate's college address, not their internal id. */
  async grant(email: string): Promise<AdminAccount> {
    const { data, error } = await this.db.rpc("admin_grant_admin", { p_email: email });
    if (error) throw fromDbError(error);
    return toAdminAccount(data as Row);
  }

  /** By id, picked from the list of current admins. */
  async revoke(userId: string): Promise<AdminAccount> {
    const { data, error } = await this.db.rpc("admin_revoke_admin", { p_user: userId });
    if (error) throw fromDbError(error);
    return toAdminAccount(data as Row);
  }
}
