import { fromDbError } from "../../domain/errors.js";
import { toAdminCard, toBookmarked, toMine } from "./mappers.js";
/** Repository pattern, read side: SQL/RPC knowledge for the list reads behind MyContentReader, AdminQueueReader and CompanyReader. Split from the writers (Interface Segregation, Single Responsibility). */
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
