/**
 * Application-layer wiring types. They live outside `domain/` on purpose: the domain must not depend on services (ADR-01).
 *
 * @typedef {object} Services
 * The services a controller may use, already bound to the caller (anonymous or one user).
 * @property {import("./services/ExperienceService.js").ExperienceService} experiences
 * @property {import("./services/MeService.js").MeService} me
 * @property {import("./services/SubmissionService.js").SubmissionService} submissions
 * @property {import("./services/LifecycleService.js").LifecycleService} lifecycle
 * @property {import("./services/InteractionService.js").InteractionService} interactions
 * @property {import("./services/ReportService.js").ReportService} reports
 * @property {import("./services/MyContentService.js").MyContentService} mine
 * @property {import("./services/ModerationService.js").ModerationService} moderation
 * @property {import("./services/CompanyService.js").CompanyService} companies
 * @property {import("./services/GuideService.js").GuideService} guides
 * @property {import("./services/CompanyAdminService.js").CompanyAdminService} companyAdmin
 * @property {import("./services/UpdateService.js").UpdateService} updates
 * @property {import("./services/AdminOpsService.js").AdminOpsService} adminOps
 * @property {import("./services/AccountService.js").AccountService} account
 *
 * @typedef {{ requestId: string, viewer: object, services: Services }} RequestContext
 */
export {};
