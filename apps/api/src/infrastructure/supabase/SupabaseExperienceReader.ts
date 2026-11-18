/**
 * infrastructure/supabase/SupabaseExperienceReader.ts — READS THE FEED AND SINGLE POSTS FROM THE DATABASE
 *
 * What it does:
 *   - findPage(): calls the database function list_experiences with the filters, sort and cursor, then maps each row
 *     to a card.
 *   - findById(): calls get_experience for one post (the database hides it if this viewer may not see it).
 *
 * System design:
 * - Repository pattern: all SQL/RPC knowledge for reading posts lives here, behind the ExperienceReader interface.
 * - Database functions (RPC) instead of raw table reads: the database decides what is public and strips the identity of
 *   anonymous authors, so private data never leaves the database.
 * - Keyset pagination: the cursor values (date or year/month, plus id) are passed to SQL, which continues after them.
 * - Mappers translate rows into API shapes; database errors become proper HTTP errors (fromDbError).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExperienceReader } from "../../domain/ports.js";
import { fromDbError } from "../../domain/errors.js";
import { toCard, toDetail } from "./mappers.js";

export class SupabaseExperienceReader implements ExperienceReader {
  constructor(private readonly db: SupabaseClient) {}

  async findPage(q: Parameters<ExperienceReader["findPage"]>[0]) {
    const { data, error } = await this.db.rpc("list_experiences", {
      // filters (null = no filter)
      p_company: q.company ?? null,
      p_role: q.role ?? null,
      p_outcome: q.outcome ?? null,
      p_year: q.year ?? null,
      p_campus: q.campus ?? null,
      p_q: q.q ?? null, // full-text search
      p_sort: q.sort,
      // "continue after" values; which ones are set depends on the sort order
      p_cursor_created: q.after?.kind === "newest" ? q.after.createdAt : null,
      p_cursor_year: q.after?.kind === "interview" ? q.after.year : null,
      p_cursor_month: q.after?.kind === "interview" ? q.after.month : null,
      p_cursor_id: q.after?.id ?? null,
      p_limit: q.limit,
    });
    if (error) throw fromDbError(error);
    return ((data ?? []) as Record<string, unknown>[]).map(toCard);
  }

  async findById(id: string) {
    const { data, error } = await this.db.rpc("get_experience", { p_id: id });
    if (error) throw fromDbError(error);
    return data ? toDetail(data as Record<string, unknown>) : null;
  }
}
