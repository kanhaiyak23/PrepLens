import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExperienceStatus, InteractionState, MeResponse, ModerationAction, ProfileUpdateDto, ReportReason } from "@preplens/shared";
import type { ExperienceWriter, InteractionWriter, ModerationWriter, ProfileWriter, ReportWriter, SubmitPayload } from "../../domain/ports.js";
import { fromDbError } from "../../domain/errors.js";


/** Repository pattern: SQL/RPC knowledge for writes lives here, behind the ports. Each rule itself is enforced in the database. */
export class SupabaseExperienceWriter implements ExperienceWriter {
  constructor(private readonly db: SupabaseClient) {}

  async submit(p: SubmitPayload): Promise<string> {
    const { data, error } = await this.db.rpc("submit_experience", { p_payload: p });
    if (error) throw fromDbError(error);
    return data as string;
  }
  async update(id: string, changes: Record<string, unknown>): Promise<"applied" | "queued"> {
    const { data, error } = await this.db.rpc("update_experience", { p_id: id, p_payload: changes });
    if (error) throw fromDbError(error);
    return data as "applied" | "queued";
  }
  async cancelUpdate(id: string): Promise<void> {
    const { error } = await this.db.rpc("cancel_experience_update", { p_id: id });
    if (error) throw fromDbError(error);
  }
  async setVisibility(id: string, publish: boolean): Promise<ExperienceStatus> {
    const { data, error } = await this.db.rpc("set_experience_visibility", { p_id: id, p_publish: publish });
    if (error) throw fromDbError(error);
    return data as ExperienceStatus;
  }
}

export class SupabaseInteractionWriter implements InteractionWriter {
  constructor(private readonly db: SupabaseClient) {}

  async setVote(id: string, on: boolean) {
    const { data, error } = await this.db.rpc("vote_experience", { p_exp: id, p_on: on });
    if (error) throw fromDbError(error);
    const d = data as { voted: boolean; upvote_count: number };
    return { voted: d.voted, upvoteCount: d.upvote_count };
  }
  async setBookmark(id: string, on: boolean) {
    const { data, error } = await this.db.rpc("bookmark_experience", { p_exp: id, p_on: on });
    if (error) throw fromDbError(error);
    return { bookmarked: (data as { bookmarked: boolean }).bookmarked };
  }
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
  async moderate(id: string, action: ModerationAction, note?: string): Promise<ExperienceStatus> {
    const { data, error } = await this.db.rpc("moderate_experience", { p_id: id, p_action: action, p_note: note ?? null });
    if (error) throw fromDbError(error);
    return data as ExperienceStatus;
  }
}

export class SupabaseProfileWriter implements ProfileWriter {
  constructor(private readonly db: SupabaseClient, private readonly userId: string) {}
  async update(dto: ProfileUpdateDto): Promise<MeResponse> {
    const patch: Record<string, unknown> = {};
    if (dto.fullName !== undefined) patch.full_name = dto.fullName;
    if (dto.graduationBatch !== undefined) patch.graduation_batch = dto.graduationBatch;
    if (dto.branch !== undefined) patch.branch = dto.branch;
    // Column grants allow only these three columns; role is not writable by users (ADR-04).
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
