/**
 * infrastructure/SupabaseRepositoryFactory.ts — BUILDS ALL DATABASE HELPERS FOR ONE CALLER
 *
 * What it does: for each request, creates one Supabase connection carrying the caller's login token (or none, for a
 * visitor), and builds every reader and writer on top of that connection.
 *
 * System design:
 * - Factory pattern: "give me the right set of repositories for this viewer". Callers never build them one by one.
 * - Least privilege (ADR-23): every query runs AS the caller, so the database's Row Level Security decides what they
 *   can see and change. A student's connection simply cannot read another student's bookmarks.
 * - Repository pattern: each Supabase* class hides the SQL / RPC details behind a domain interface (port).
 */
import type { Config } from "../config/env.js";
import type { RepositoryFactory, ScopedRepositories } from "../domain/ports.js";
import type { Viewer } from "../domain/viewer.js";
import { createUserClient } from "./supabase/clients.js";
import { SupabaseExperienceReader } from "./supabase/SupabaseExperienceReader.js";
import { SupabaseAdminPostWriter, SupabaseAdminRoleWriter, SupabaseReportQueue, SupabaseUpdateReviewWriter } from "./supabase/SupabaseAdminWriters.js";
import { SupabaseGuideSourceReader, SupabaseCompanyAdminWriter } from "./supabase/SupabaseGuide.js";
import { SupabaseProfileReader } from "./supabase/SupabaseProfileReader.js";
import { SupabaseAdminQueueReader, SupabaseCompanyReader, SupabaseMyContentReader } from "./supabase/SupabaseReaders.js";
import {
  SupabaseExperienceWriter, SupabaseInteractionWriter, SupabaseModerationWriter, SupabaseProfileWriter, SupabaseReportWriter,
} from "./supabase/SupabaseWriters.js";

export class SupabaseRepositoryFactory implements RepositoryFactory {
  constructor(private readonly cfg: Pick<Config, "SUPABASE_URL" | "SUPABASE_ANON_KEY">) {}

  for(viewer: Viewer): ScopedRepositories {
    // One connection per request: with the user's token if signed in, without one for a visitor.
    const db = createUserClient(this.cfg, viewer.kind === "user" ? viewer.token : undefined);
    return {
      experiences: new SupabaseExperienceReader(db),
      mine: new SupabaseMyContentReader(db),
      adminQueue: new SupabaseAdminQueueReader(db),
      companies: new SupabaseCompanyReader(db),
      experienceWriter: new SupabaseExperienceWriter(db),
      interactions: new SupabaseInteractionWriter(db),
      reports: new SupabaseReportWriter(db),
      moderation: new SupabaseModerationWriter(db),
      profiles: new SupabaseProfileReader(db),
      profileWriter: new SupabaseProfileWriter(db, viewer.kind === "user" ? viewer.id : ""),
      guideSources: new SupabaseGuideSourceReader(db),
      companyAdmin: new SupabaseCompanyAdminWriter(db),
      updateReview: new SupabaseUpdateReviewWriter(db),
      reportQueue: new SupabaseReportQueue(db),
      adminPost: new SupabaseAdminPostWriter(db),
      adminRoles: new SupabaseAdminRoleWriter(db),
    };
  }
}
