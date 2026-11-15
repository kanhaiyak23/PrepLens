import { fromDbError } from "../../domain/errors.js";
import { toCard, toDetail } from "./mappers.js";
/** Repository pattern: all SQL/RPC knowledge for reading experiences lives here, behind the ExperienceReader port. */
export class SupabaseExperienceReader {
    db;
    constructor(db) {
        this.db = db;
    }
    async findPage(q) {
        const { data, error } = await this.db.rpc("list_experiences", {
            p_company: q.company ?? null,
            p_role: q.role ?? null,
            p_outcome: q.outcome ?? null,
            p_year: q.year ?? null,
            p_campus: q.campus ?? null,
            p_q: q.q ?? null,
            p_sort: q.sort,
            p_cursor_created: q.after?.kind === "newest" ? q.after.createdAt : null,
            p_cursor_year: q.after?.kind === "interview" ? q.after.year : null,
            p_cursor_month: q.after?.kind === "interview" ? q.after.month : null,
            p_cursor_id: q.after?.id ?? null,
            p_limit: q.limit,
        });
        if (error)
            throw fromDbError(error);
        return (data ?? []).map(toCard);
    }
    async findById(id) {
        const { data, error } = await this.db.rpc("get_experience", { p_id: id });
        if (error)
            throw fromDbError(error);
        return data ? toDetail(data) : null;
    }
}
