/**
 * context.ts — WHAT EVERY REQUEST CARRIES WITH IT
 *
 * What it does: defines two shapes (types only, no logic):
 *   - Services: the list of all services a controller can use.
 *   - RequestContext: attached to each request — its id, who is calling (viewer), and their services.
 *
 * System design:
 * - Layered architecture: this lives OUTSIDE the domain folder on purpose. The domain (core rules) must never
 *   depend on services (ADR-01); dependencies only point inwards.
 * - Request-scoped context: each request gets its own services already bound to the caller,
 *   so a controller can never accidentally act as someone else.
 */
import type { Viewer } from "./domain/viewer.js";
import type { ExperienceService } from "./services/ExperienceService.js";
import type { MeService } from "./services/MeService.js";
import type { SubmissionService } from "./services/SubmissionService.js";
import type { LifecycleService } from "./services/LifecycleService.js";
import type { InteractionService } from "./services/InteractionService.js";
import type { ReportService } from "./services/ReportService.js";
import type { MyContentService } from "./services/MyContentService.js";
import type { ModerationService } from "./services/ModerationService.js";
import type { CompanyService } from "./services/CompanyService.js";
import type { GuideService } from "./services/GuideService.js";
import type { CompanyAdminService } from "./services/CompanyAdminService.js";
import type { UpdateService } from "./services/UpdateService.js";
import type { AdminOpsService } from "./services/AdminOpsService.js";
import type { AdminRoleService } from "./services/AdminRoleService.js";
import type { AccountService } from "./services/AccountService.js";

/** All services, already bound to the person calling (a visitor or one signed-in user). */
export type Services = {
  experiences: ExperienceService;   // feed and single post
  me: MeService;                    // my profile
  submissions: SubmissionService;   // post a new experience
  lifecycle: LifecycleService;      // unpublish / republish my post
  interactions: InteractionService; // votes and bookmarks
  reports: ReportService;           // report a post
  mine: MyContentService;           // my posts and saved posts
  moderation: ModerationService;    // admin: approve / reject / remove / reinstate
  companies: CompanyService;        // company list
  guides: GuideService;             // AI prep guide
  companyAdmin: CompanyAdminService; // admin: approve or merge companies
  updates: UpdateService;           // edit my post
  adminOps: AdminOpsService;        // admin: edit queue, reports, post on behalf
  adminRoles: AdminRoleService;     // admin: make or remove admins
  account: AccountService;          // delete my account
};

/** Attached to every request as req.ctx: request id (for tracing), who is calling, and their services. */
export type RequestContext = { requestId: string; viewer: Viewer; services: Services };
