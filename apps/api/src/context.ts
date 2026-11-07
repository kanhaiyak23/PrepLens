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
import type { AccountService } from "./services/AccountService.js";

/**
 * Application-layer wiring types. They live outside `domain/` on purpose: the domain must not depend on services (ADR-01).
 * The services a controller may use, already bound to the caller (anonymous or one user). */
export type Services = {
  experiences: ExperienceService;
  me: MeService;
  submissions: SubmissionService;
  lifecycle: LifecycleService;
  interactions: InteractionService;
  reports: ReportService;
  mine: MyContentService;
  moderation: ModerationService;
  companies: CompanyService;
  guides: GuideService;
  companyAdmin: CompanyAdminService;
  updates: UpdateService;
  adminOps: AdminOpsService;
  account: AccountService;
};

export type RequestContext = { requestId: string; viewer: Viewer; services: Services };
