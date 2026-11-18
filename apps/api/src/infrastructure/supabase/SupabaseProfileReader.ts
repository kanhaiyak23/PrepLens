/**
 * infrastructure/supabase/SupabaseProfileReader.ts — READS MY PROFILE FROM THE DATABASE
 *
 * What it does: reads the caller's row from the "profiles" table and converts it to the API shape
 * (snake_case database columns -> camelCase fields). Also works out "profileComplete" (batch and branch are filled in).
 *
 * System design:
 * - Repository + Adapter: hides the table and column names behind the ProfileReader interface.
 * - Row Level Security does the filtering: there is no "where id = ..." here, because the database only lets a user
 *   see their OWN profile row. Security is enforced by the database, not by remembering to add a filter.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MeResponse } from "@preplens/shared";
import type { ProfileReader } from "../../domain/ports.js";
import { UpstreamError } from "../../domain/errors.js";

export class SupabaseProfileReader implements ProfileReader {
  constructor(private readonly db: SupabaseClient) {}

  async getMe(): Promise<MeResponse | null> {
    // RLS rule "profiles_read_self" means this returns only the caller's own row.
    const { data, error } = await this.db
      .from("profiles")
      .select("id, email, full_name, avatar_url, graduation_batch, branch, role")
      .maybeSingle();
    if (error) throw new UpstreamError("Your profile could not be loaded.");
    if (!data) return null;
    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      avatarUrl: data.avatar_url,
      graduationBatch: data.graduation_batch,
      branch: data.branch,
      role: data.role,
      profileComplete: data.graduation_batch !== null && data.branch !== null,
    };
  }
}
