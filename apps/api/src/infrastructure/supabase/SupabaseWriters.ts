/**
 * infrastructure/supabase/SupabaseWriters.ts — WRITES TO THE DATABASE (posts, votes, reports, moderation, profile)
 *
 * What it does: each class implements one writer interface by calling a database function:
 *   - SupabaseExperienceWriter: submit, edit, cancel edit, unpublish/republish  (submit_experience, update_experience...)
 *   - SupabaseInteractionWriter: vote, bookmark, "which did I vote on / save"    (vote_experience, bookmark_experience...)
 *   - SupabaseReportWriter: report a post                                         (report_experience)
 *   - SupabaseModerationWriter: admin approve/reject/remove/reinstate             (moderate_experience)
 *   - SupabaseProfileWriter: update my batch, branch or name
 *
 * System design:
 * - Repository + Adapter: the services only see the interfaces; the SQL details stay here.
 * - Business rules enforced in the database (ADR-14): each multi-step write is ONE database function, which runs as one
 *   transaction (all or nothing) and checks the rules itself — consent, legal status changes, one vote per person,
 *   admins only, and writing the audit log.
 * - Least privilege: profile updates can only touch three columns; the database doesn't let users change their role.
 * - Error translation: every database error becomes a proper HTTP error via fromDbError().
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExperienceStatus, InteractionState, MeResponse, ModerationAction, ProfileUpdateDto, ReportReason } from "@preplens/shared";
import type { ExperienceWriter, InteractionWriter, ModerationWriter, ProfileWriter, ReportWriter, SubmitPayload } from "../../domain/ports.js";
import { fromDbError } from "../../domain/errors.js";

export class SupabaseExperienceWriter implements ExperienceWriter {
  constructor(private readonly db: SupabaseClient) {}

  /** Saves the post with its rounds and questions in one transaction; returns the new id. */
  async submit(p: SubmitPayload): Promise<string> {
    const { data, error } = await this.db.rpc("submit_experience", { p_payload: p });
    if (error) throw fromDbError(error);
    return data as string;
  }
  /** The database decides: post not live -> "applied"; live post -> "queued" for admin review. */
  async update(id: string, changes: Record<string, unknown>): Promise<"applied" | "queued"> {
    const { data, error } = await this.db.rpc("update_experience", { p_id: id, p_payload: changes });
    if (error) throw fromDbError(error);
    return data as "applied" | "queued";
  }
  async cancelUpdate(id: string): Promise<void> {
    const { error } = await this.db.rpc("cancel_experience_update", { p_id: id });
    if (error) throw fromDbError(error);
  }
  /** Unpublish or republish. The database's state machine refuses illegal moves. */
  async setVisibility(id: string, publish: boolean): Promise<ExperienceStatus> {
    const { data, error } = await this.db.rpc("set_experience_visibility", { p_id: id, p_publish: publish });
    if (error) throw fromDbError(error);
    return data as ExperienceStatus;
  }
}

export class SupabaseInteractionWriter implements InteractionWriter {
  constructor(private readonly db: SupabaseClient) {}

  /** Vote on/off. A unique rule (user + post) in the database makes double votes impossible. */
  async setVote(id: string, on: boolean) {
    const { data, error } = await this.db.rpc("vote_experience", { p_exp: id, p_on: on });
    if (error) throw fromDbError(error);
    const d = data as { voted: boolean; upvote_count: number };
    return { voted: d.voted, upvoteCount: d.upvote_count };
  }
  /** Save/unsave a post. */
  async setBookmark(id: string, on: boolean) {
    const { data, error } = await this.db.rpc("bookmark_experience", { p_exp: id, p_on: on });
    if (error) throw fromDbError(error);
    return { bookmarked: (data as { bookmarked: boolean }).bookmarked };
  }
  /** Of these post ids, which did I vote on and which did I save? */
  async interactions(ids: string[]): Promise<InteractionState> {
    const { data, error } = await this.db.rpc("my_interactions", { p_ids: ids });
    if (error) throw fromDbError(error);
    const d = data as InteractionState;
    return { voted: d.voted ?? [], bookmarked: d.bookmarked ?? [] };
  }
}

export class SupabaseReportWriter implements ReportWriter {
  constructor(private readonly db: SupabaseClient) {}
  async report(id: string, reason: ReportReason, note?: string): Promise<string> {
    const { data, error } = await this.db.rpc("report_experience", { p_exp: id, p_reason: reason, p_note: note ?? null });
    if (error) throw fromDbError(error);
    return data as string;
  }
}

export class SupabaseModerationWriter implements ModerationWriter {
  constructor(private readonly db: SupabaseClient) {}
  /**
   * One database call does everything in one transaction: checks admin, changes the status only if it is still the
   * expected one (if another admin got there first -> 409 Conflict), and writes the moderation-log row.
   */
  async moderate(id: string, action: ModerationAction, note?: string): Promise<ExperienceStatus> {
    const { data, error } = await this.db.rpc("moderate_experience", { p_id: id, p_action: action, p_note: note ?? null });
    if (error) throw fromDbError(error);
    return data as ExperienceStatus;
  }
}

export class SupabaseProfileWriter implements ProfileWriter {
  constructor(private readonly db: SupabaseClient, private readonly userId: string) {}
  async update(dto: ProfileUpdateDto): Promise<MeResponse> {
    // Build the change from allowed fields only (camelCase -> database snake_case).
    const patch: Record<string, unknown> = {};
    if (dto.fullName !== undefined) patch.full_name = dto.fullName;
    if (dto.graduationBatch !== undefined) patch.graduation_batch = dto.graduationBatch;
    if (dto.branch !== undefined) patch.branch = dto.branch;
    // The database only lets users write these three columns. "role" is not writable by users at all (ADR-04).
    const { data, error } = await this.db.from("profiles").update(patch).eq("id", this.userId)
      .select("id, email, full_name, avatar_url, graduation_batch, branch, role").single();
    if (error) throw fromDbError(error);
    return {
      id: data.id, email: data.email, fullName: data.full_name, avatarUrl: data.avatar_url,
      graduationBatch: data.graduation_batch, branch: data.branch, role: data.role,
      profileComplete: data.graduation_batch !== null && data.branch !== null,
    };
  }
}
