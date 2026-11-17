import type { SupabaseClient } from "@supabase/supabase-js";
import type { MeResponse } from "@preplens/shared";
import type { ProfileReader } from "../../domain/ports.js";
import { UpstreamError } from "../../domain/errors.js";

export class SupabaseProfileReader implements ProfileReader {
  constructor(private readonly db: SupabaseClient) {}

  async getMe(): Promise<MeResponse | null> {
    // RLS limits this to the caller's own row (profiles_read_self).
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
