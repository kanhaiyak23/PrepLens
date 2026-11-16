import { fromDbError } from "../../domain/errors.js";
/** Repository pattern: SQL/RPC knowledge for writes lives here, behind the ports. Each rule itself is enforced in the database. */
export class SupabaseExperienceWriter {
    db;
    constructor(db) {
        this.db = db;
    }
    async submit(p) {
        const { data, error } = await this.db.rpc("submit_experience", { p_payload: p });
        if (error)
            throw fromDbError(error);
        return data;
    }
    async update(id, changes) {
        const { data, error } = await this.db.rpc("update_experience", { p_id: id, p_payload: changes });
        if (error)
            throw fromDbError(error);
        return data;
    }
    async cancelUpdate(id) {
        const { error } = await this.db.rpc("cancel_experience_update", { p_id: id });
        if (error)
            throw fromDbError(error);
    }
    async setVisibility(id, publish) {
        const { data, error } = await this.db.rpc("set_experience_visibility", { p_id: id, p_publish: publish });
        if (error)
            throw fromDbError(error);
        return data;
    }
}
export class SupabaseInteractionWriter {
    db;
    constructor(db) {
        this.db = db;
    }
    async setVote(id, on) {
        const { data, error } = await this.db.rpc("vote_experience", { p_exp: id, p_on: on });
        if (error)
            throw fromDbError(error);
        const d = data;
        return { voted: d.voted, upvoteCount: d.upvote_count };
    }
    async setBookmark(id, on) {
        const { data, error } = await this.db.rpc("bookmark_experience", { p_exp: id, p_on: on });
        if (error)
            throw fromDbError(error);
        return { bookmarked: data.bookmarked };
    }
    async interactions(ids) {
        const { data, error } = await this.db.rpc("my_interactions", { p_ids: ids });
        if (error)
            throw fromDbError(error);
        const d = data;
        return { voted: d.voted ?? [], bookmarked: d.bookmarked ?? [] };
    }
}
export class SupabaseReportWriter {
    db;
    constructor(db) {
        this.db = db;
    }
    async report(id, reason, note) {
        const { data, error } = await this.db.rpc("report_experience", { p_exp: id, p_reason: reason, p_note: note ?? null });
        if (error)
            throw fromDbError(error);
        return data;
    }
}
export class SupabaseModerationWriter {
    db;
    constructor(db) {
        this.db = db;
    }
    async moderate(id, action, note) {
        const { data, error } = await this.db.rpc("moderate_experience", { p_id: id, p_action: action, p_note: note ?? null });
        if (error)
            throw fromDbError(error);
        return data;
    }
}
export class SupabaseProfileWriter {
    db;
    userId;
    constructor(db, userId) {
        this.db = db;
        this.userId = userId;
    }
    async update(dto) {
        const patch = {};
        if (dto.fullName !== undefined)
            patch.full_name = dto.fullName;
        if (dto.graduationBatch !== undefined)
            patch.graduation_batch = dto.graduationBatch;
        if (dto.branch !== undefined)
            patch.branch = dto.branch;
        // Column grants allow only these three columns; role is not writable by users (ADR-04).
        const { data, error } = await this.db.from("profiles").update(patch).eq("id", this.userId)
            .select("id, email, full_name, avatar_url, graduation_batch, branch, role").single();
        if (error)
            throw fromDbError(error);
        return {
            id: data.id, email: data.email, fullName: data.full_name, avatarUrl: data.avatar_url,
            graduationBatch: data.graduation_batch, branch: data.branch, role: data.role,
            profileComplete: data.graduation_batch !== null && data.branch !== null,
        };
    }
}
