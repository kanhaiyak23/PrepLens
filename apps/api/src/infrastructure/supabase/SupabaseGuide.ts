/**
 * infrastructure/supabase/SupabaseGuide.ts — DATABASE CALLS FOR THE AI GUIDE AND FOR COMPANY APPROVAL
 *
 * What it does:
 *   - SupabaseGuideSourceReader: gets a company and up to 30 of its published posts (authors already anonymised),
 *     to feed the AI.
 *   - SupabaseGuideRepository: loads and saves the cached guide in the company_guides table.
 *   - SupabaseCompanyAdminWriter: lists pending company names; approves or merges one (admins only).
 *
 * System design:
 * - Repository + Adapter: each class implements a port from ports.ts; the SQL stays here.
 * - Cache as a system resource (ADR-23): guides belong to the system, not to a user, so the guide repository uses the
 *   service key. Users can't write to the cache directly.
 * - Upsert on company id: saving twice at the same moment leaves exactly ONE guide row per company (no duplicates).
 * - Defensive reading: a cached row that no longer matches the schema is treated as "no cache" and simply rebuilt.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GuideRepository, GuideSourceReader, CompanyAdminWriter } from "../../domain/ports.js";
import { CompanyGuide, guideSchema, type CompanySources, type SourceExperience } from "../../domain/guide/CompanyGuide.js";
import { fromDbError } from "../../domain/errors.js";
import type { PendingCompany } from "@preplens/shared";

type Row = Record<string, unknown>;

/** Reads the posts the AI will summarise. */
export class SupabaseGuideSourceReader implements GuideSourceReader {
  constructor(private readonly db: SupabaseClient) {}

  async forCompany(slug: string): Promise<CompanySources | null> {
    const { data, error } = await this.db.rpc("list_company_sources", { p_slug: slug, p_limit: 30 });
    if (error) throw fromDbError(error);
    if (!data) return null; // unknown company
    const d = data as { company: CompanySources["company"]; experiences: Row[] };
    // Database rows -> our SourceExperience shape (snake_case -> camelCase).
    const experiences: SourceExperience[] = d.experiences.map((e) => ({
      id: e.id as string, role: e.role as string, driveType: e.drive_type as string, interviewYear: e.interview_year as number,
      outcome: e.outcome as string, updatedAt: e.updated_at as string, author: (e.author as SourceExperience["author"]),
      rounds: ((e.rounds as Row[]) ?? []).map((r) => ({ name: r.name as string, tips: (r.tips as string) ?? null, questions: ((r.questions as Row[]) ?? []).map((q) => ({ text: q.text as string, topic: (q.topic as string) ?? null })) })),
    }));
    return { company: d.company, experiences };
  }
}

/** The guide cache. Uses the service key, because the cache belongs to the system. */
export class SupabaseGuideRepository implements GuideRepository {
  constructor(private readonly service: SupabaseClient) {}

  /** Load the saved guide for a company, or null if there is none (or it can't be read). */
  async find(companyId: string): Promise<CompanyGuide | null> {
    const { data, error } = await this.service.from("company_guides").select("*").eq("company_id", companyId).maybeSingle();
    if (error) throw fromDbError(error);
    if (!data) return null;
    const stored = data.content as { guide: unknown; stats: CompanyGuide["stats"]; sources: CompanyGuide["sourcesSnapshot"] };
    const parsed = guideSchema.safeParse(stored.guide);
    if (!parsed.success) return null;   // unreadable row -> treat as no cache, so a fresh guide is generated
    return new CompanyGuide(companyId, data.fingerprint as string, parsed.data, (data.source_ids as string[]) ?? [], stored.sources ?? [], stored.stats, (data.model as string) ?? "unknown", new Date(data.generated_at as string));
  }

  /** Save (insert or replace) the guide. One row per company, even if two saves happen at once. */
  async save(g: CompanyGuide): Promise<void> {
    const { error } = await this.service.from("company_guides").upsert(
      { company_id: g.companyId, fingerprint: g.fingerprint, content: { guide: g.content, stats: g.stats, sources: g.sourcesSnapshot }, source_ids: g.sourceIds, model: g.model, generated_at: g.generatedAt.toISOString() },
      { onConflict: "company_id" },
    );
    if (error) throw fromDbError(error);
  }
}

/** Admin: new company names. The database functions check the caller is an admin and log every decision. */
export class SupabaseCompanyAdminWriter implements CompanyAdminWriter {
  constructor(private readonly db: SupabaseClient) {}

  async listPending(): Promise<PendingCompany[]> {
    const { data, error } = await this.db.rpc("admin_list_pending_companies");
    if (error) throw fromDbError(error);
    return ((data ?? []) as Row[]).map((r) => ({ name: r.name as string, slug: r.slug as string, createdAt: r.created_at as string, postCount: r.post_count as number }));
  }

  /** Approve, or merge into another company. A merge moves every post and keeps the old name as an alias, all in one transaction. */
  async decide(slug: string, action: "approve" | "merge", mergeInto?: string): Promise<string> {
    const { data, error } = await this.db.rpc("admin_decide_company", { p_slug: slug, p_action: action, p_merge_into: mergeInto ?? null });
    if (error) throw fromDbError(error);
    return data as string;
  }
}
