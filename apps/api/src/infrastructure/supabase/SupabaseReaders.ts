/**
 * infrastructure/supabase/SupabaseReaders.ts — READS LISTS FROM THE DATABASE
 *
 * What it does: three read-only classes:
 *   - SupabaseMyContentReader: my posts, and my saved posts (paged).
 *   - SupabaseAdminQueueReader: the admin review queue for a status (paged).
 *   - SupabaseCompanyReader: the company list, optionally filtered by what the user typed.
 *
 * System design:
 * - Repository pattern (read side): all SQL/RPC details for these lists live here, behind small interfaces.
 * - Reads separated from writes (Interface Segregation, Single Responsibility): these classes cannot change data.
 * - Security in the database: "my" lists only return the caller's own rows, and the admin queue function checks the
 *   caller is an admin, because every query runs as the caller.
 * - Mappers turn database rows into API shapes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminCard, BookmarkedCard, CompanySummary, ExperienceStatus, MyExperience } from "@preplens/shared";
import type { AdminQueueReader, CompanyReader, Keyset, MyContentReader } from "../../domain/ports.js";
import { fromDbError } from "../../domain/errors.js";
import { toAdminCard, toBookmarked, toMine } from "./mappers.js";

type Rows = Record<string, unknown>[];

export class SupabaseMyContentReader implements MyContentReader {
  constructor(private readonly db: SupabaseClient) {}
  /** All my posts, in every status. */
  async listMine(): Promise<MyExperience[]> {
    const { data, error } = await this.db.rpc("list_my_experiences");
    if (error) throw fromDbError(error);
    return ((data ?? []) as Rows).map(toMine);
  }
  /** My saved posts, continuing after the cursor position. */
  async listBookmarks(q: { after?: Keyset; limit: number }): Promise<BookmarkedCard[]> {
    const { data, error } = await this.db.rpc("list_my_bookmarks", { p_cursor_at: q.after?.at ?? null, p_cursor_id: q.after?.id ?? null, p_limit: q.limit });
    if (error) throw fromDbError(error);
    return ((data ?? []) as Rows).map(toBookmarked);
  }
}

export class SupabaseAdminQueueReader implements AdminQueueReader {
  constructor(private readonly db: SupabaseClient) {}
  /** Posts in one status (e.g. pending), with how many open reports each has. The database refuses non-admins. */
  async list(q: { status: ExperienceStatus; after?: Keyset; limit: number }): Promise<AdminCard[]> {
    const { data, error } = await this.db.rpc("admin_list_experiences", { p_status: q.status, p_cursor_created: q.after?.at ?? null, p_cursor_id: q.after?.id ?? null, p_limit: q.limit });
    if (error) throw fromDbError(error);
    return ((data ?? []) as Rows).map(toAdminCard);
  }
}

export class SupabaseCompanyReader implements CompanyReader {
  constructor(private readonly db: SupabaseClient) {}
  /** Companies with the most posts first. Only approved (active) companies are visible, thanks to RLS. */
  async list(q: { prefix?: string; limit: number }): Promise<CompanySummary[]> {
    let query = this.db.from("companies").select("name, slug, experience_count").order("experience_count", { ascending: false }).order("name").limit(q.limit);
    if (q.prefix) {
      // "starts with" search. Special characters (% _ \) are escaped so user text can't act as a wildcard,
      // and lower-case + "starts with" lets the database use its name_lower index (fast).
      const safe = q.prefix.toLowerCase().replace(/[%_\\]/g, (c) => `\\${c}`);
      query = query.like("name_lower", `${safe}%`);
    }
    const { data, error } = await query;
    if (error) throw fromDbError(error);
    return (data ?? []).map((c) => ({ name: c.name as string, slug: c.slug as string, experienceCount: c.experience_count as number }));
  }
}
