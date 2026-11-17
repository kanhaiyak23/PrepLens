import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminCard, BookmarkedCard, CompanySummary, ExperienceStatus, MyExperience } from "@preplens/shared";
import type { AdminQueueReader, CompanyReader, Keyset, MyContentReader } from "../../domain/ports.js";
import { fromDbError } from "../../domain/errors.js";
import { toAdminCard, toBookmarked, toMine } from "./mappers.js";

type Rows = Record<string, unknown>[];

/**
 * Repository pattern, read side: SQL/RPC knowledge for the list reads behind MyContentReader, AdminQueueReader and CompanyReader.
 * Split from the writers (Interface Segregation, Single Responsibility).
 */
export class SupabaseMyContentReader implements MyContentReader {
  constructor(private readonly db: SupabaseClient) {}
  async listMine(): Promise<MyExperience[]> {
    const { data, error } = await this.db.rpc("list_my_experiences");
    if (error) throw fromDbError(error);
    return ((data ?? []) as Rows).map(toMine);
  }
  async listBookmarks(q: { after?: Keyset; limit: number }): Promise<BookmarkedCard[]> {
    const { data, error } = await this.db.rpc("list_my_bookmarks", { p_cursor_at: q.after?.at ?? null, p_cursor_id: q.after?.id ?? null, p_limit: q.limit });
    if (error) throw fromDbError(error);
    return ((data ?? []) as Rows).map(toBookmarked);
  }
}

export class SupabaseAdminQueueReader implements AdminQueueReader {
  constructor(private readonly db: SupabaseClient) {}
  async list(q: { status: ExperienceStatus; after?: Keyset; limit: number }): Promise<AdminCard[]> {
    const { data, error } = await this.db.rpc("admin_list_experiences", { p_status: q.status, p_cursor_created: q.after?.at ?? null, p_cursor_id: q.after?.id ?? null, p_limit: q.limit });
    if (error) throw fromDbError(error);
    return ((data ?? []) as Rows).map(toAdminCard);
  }
}

export class SupabaseCompanyReader implements CompanyReader {
  constructor(private readonly db: SupabaseClient) {}
  async list(q: { prefix?: string; limit: number }): Promise<CompanySummary[]> {
    // RLS exposes only active companies. The prefix is lower-cased and anchored so the name_lower index can be used.
    let query = this.db.from("companies").select("name, slug, experience_count").order("experience_count", { ascending: false }).order("name").limit(q.limit);
    if (q.prefix) {
      const safe = q.prefix.toLowerCase().replace(/[%_\\]/g, (c) => `\\${c}`);
      query = query.like("name_lower", `${safe}%`);
    }
    const { data, error } = await query;
    if (error) throw fromDbError(error);
    return (data ?? []).map((c) => ({ name: c.name as string, slug: c.slug as string, experienceCount: c.experience_count as number }));
  }
}
