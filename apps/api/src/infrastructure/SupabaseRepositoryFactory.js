import { createUserClient } from "./supabase/clients.js";
import { SupabaseExperienceReader } from "./supabase/SupabaseExperienceReader.js";
import { SupabaseAdminPostWriter, SupabaseReportQueue, SupabaseUpdateReviewWriter } from "./supabase/SupabaseAdminWriters.js";
import { SupabaseGuideSourceReader, SupabaseCompanyAdminWriter } from "./supabase/SupabaseGuide.js";
import { SupabaseProfileReader } from "./supabase/SupabaseProfileReader.js";
import { SupabaseAdminQueueReader, SupabaseCompanyReader, SupabaseMyContentReader } from "./supabase/SupabaseReaders.js";
import { SupabaseExperienceWriter, SupabaseInteractionWriter, SupabaseModerationWriter, SupabaseProfileWriter, SupabaseReportWriter } from "./supabase/SupabaseWriters.js";
/** Factory pattern: the right set of repositories for whoever is calling (anonymous or a specific user). */
export class SupabaseRepositoryFactory {
    cfg;
    constructor(cfg) {
        this.cfg = cfg;
    }
    for(viewer) {
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
        };
    }
}
