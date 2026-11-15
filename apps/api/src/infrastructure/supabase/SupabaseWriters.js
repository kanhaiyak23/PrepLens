import { fromDbError } from "../../domain/errors.js";
import { toAdminCard, toBookmarked, toMine } from "./mappers2.js";
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
export class SupabaseMyContentReader {
    db;
    constructor(db) {
        this.db = db;
    }
    async listMine() {
        const { data, error } = await this.db.rpc("list_my_experiences");
        if (error)
            throw fromDbError(error);
        return (data ?? []).map(toMine);
    }
    async listBookmarks(q) {
        const { data, error } = await this.db.rpc("list_my_bookmarks", { p_cursor_at: q.after?.at ?? null, p_cursor_id: q.after?.id ?? null, p_limit: q.limit });
        if (error)
            throw fromDbError(error);
        return (data ?? []).map(toBookmarked);
    }
}
export class SupabaseAdminQueueReader {
    db;
    constructor(db) {
        this.db = db;
    }
    async list(q) {
        const { data, error } = await this.db.rpc("admin_list_experiences", { p_status: q.status, p_cursor_created: q.after?.at ?? null, p_cursor_id: q.after?.id ?? null, p_limit: q.limit });
        if (error)
            throw fromDbError(error);
        return (data ?? []).map(toAdminCard);
    }
}
export class SupabaseCompanyReader {
    db;
    constructor(db) {
        this.db = db;
    }
    async list(q) {
        // RLS exposes only active companies. The prefix is lower-cased and anchored so the name_lower index can be used.
        let query = this.db.from("companies").select("name, slug, experience_count").order("experience_count", { ascending: false }).order("name").limit(q.limit);
        if (q.prefix) {
            const safe = q.prefix.toLowerCase().replace(/[%_\\]/g, (c) => `\\${c}`);
            query = query.like("name_lower", `${safe}%`);
        }
        const { data, error } = await query;
        if (error)
            throw fromDbError(error);
        return (data ?? []).map((c) => ({ name: c.name, slug: c.slug, experienceCount: c.experience_count }));
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
