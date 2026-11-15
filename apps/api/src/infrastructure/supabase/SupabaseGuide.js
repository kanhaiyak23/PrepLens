import { CompanyGuide, guideSchema } from "../../domain/guide/CompanyGuide.js";
import { fromDbError } from "../../domain/errors.js";
export class SupabaseGuideSourceReader {
    db;
    constructor(db) {
        this.db = db;
    }
    async forCompany(slug) {
        const { data, error } = await this.db.rpc("list_company_sources", { p_slug: slug, p_limit: 30 });
        if (error)
            throw fromDbError(error);
        if (!data)
            return null;
        const d = data;
        const experiences = d.experiences.map((e) => ({
            id: e.id, role: e.role, driveType: e.drive_type, interviewYear: e.interview_year,
            outcome: e.outcome, updatedAt: e.updated_at, author: e.author,
            rounds: (e.rounds ?? []).map((r) => ({ name: r.name, tips: r.tips ?? null, questions: (r.questions ?? []).map((q) => ({ text: q.text, topic: q.topic ?? null })) })),
        }));
        return { company: d.company, experiences };
    }
}
/** Service-role repository: the cache belongs to the system, not to a user (ADR-23, docs/design/08 section 8.6). */
export class SupabaseGuideRepository {
    service;
    constructor(service) {
        this.service = service;
    }
    async find(companyId) {
        const { data, error } = await this.service.from("company_guides").select("*").eq("company_id", companyId).maybeSingle();
        if (error)
            throw fromDbError(error);
        if (!data)
            return null;
        const stored = data.content;
        const parsed = guideSchema.safeParse(stored.guide);
        if (!parsed.success)
            return null; // a row we cannot read is treated as a cache miss
        return new CompanyGuide(companyId, data.fingerprint, parsed.data, data.source_ids ?? [], stored.sources ?? [], stored.stats, data.model ?? "unknown", new Date(data.generated_at));
    }
    async save(g) {
        const { error } = await this.service.from("company_guides").upsert({ company_id: g.companyId, fingerprint: g.fingerprint, content: { guide: g.content, stats: g.stats, sources: g.sourcesSnapshot }, source_ids: g.sourceIds, model: g.model, generated_at: g.generatedAt.toISOString() }, { onConflict: "company_id" });
        if (error)
            throw fromDbError(error);
    }
}
export class SupabaseCompanyAdminWriter {
    db;
    constructor(db) {
        this.db = db;
    }
    async listPending() {
        const { data, error } = await this.db.rpc("admin_list_pending_companies");
        if (error)
            throw fromDbError(error);
        return (data ?? []).map((r) => ({ name: r.name, slug: r.slug, createdAt: r.created_at, postCount: r.post_count }));
    }
    async decide(slug, action, mergeInto) {
        const { data, error } = await this.db.rpc("admin_decide_company", { p_slug: slug, p_action: action, p_merge_into: mergeInto ?? null });
        if (error)
            throw fromDbError(error);
        return data;
    }
}
