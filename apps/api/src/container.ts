/**
 * container.ts — THE COMPOSITION ROOT (where every object is created and connected)
 *
 * What it does: creates the real objects the API uses (Supabase adapters, Gemini AI client, rate limiter,
 * token checker) and gives each service the helpers it needs.
 *
 * System design:
 * - Dependency Injection: services never create their own database or AI objects. They RECEIVE them here
 *   through their constructor. This is the only file that names concrete classes like "SupabaseXxx" or "GeminiClient".
 * - Dependency Inversion (the D in SOLID): services depend on interfaces (domain/ports.ts); this file decides
 *   which real class fulfils each interface. Tests build the same container with in-memory fakes,
 *   so all 130 tests run without a real database.
 * - Per-request services: servicesFor(viewer) builds a fresh set of services for EACH request, bound to the
 *   person calling. That way every database call runs as that user, and database security rules (RLS) apply.
 */
import type { Config } from "./config/env.js";
import type { RateLimiter, RepositoryFactory, TokenVerifier } from "./domain/ports.js";
import type { Services } from "./context.js";
import type { Viewer } from "./domain/viewer.js";
import { createLogger, type Logger } from "./lib/logger.js";
import { ExperienceService } from "./services/ExperienceService.js";
import { MeService } from "./services/MeService.js";
import { SubmissionService } from "./services/SubmissionService.js";
import { LifecycleService } from "./services/LifecycleService.js";
import { InteractionService } from "./services/InteractionService.js";
import { ReportService } from "./services/ReportService.js";
import { MyContentService } from "./services/MyContentService.js";
import { ModerationService } from "./services/ModerationService.js";
import { CompanyService } from "./services/CompanyService.js";
import { GuideService } from "./services/GuideService.js";
import { CompanyAdminService } from "./services/CompanyAdminService.js";
import { UpdateService } from "./services/UpdateService.js";
import { AdminOpsService } from "./services/AdminOpsService.js";
import { AccountService } from "./services/AccountService.js";
import { AdminRoleService } from "./services/AdminRoleService.js";
import type { AccountDeleter } from "./domain/ports.js";
import { SupabaseAccountDeleter } from "./infrastructure/supabase/SupabaseAdminWriters.js";
import type { GuideRepository, LlmClient } from "./domain/ports.js";
import { GeminiClient } from "./infrastructure/llm/GeminiClient.js";
import { FallbackLlmClient } from "./infrastructure/llm/FallbackLlmClient.js";
import { SupabaseGuideRepository } from "./infrastructure/supabase/SupabaseGuide.js";
import { createServiceClient, createUserClient } from "./infrastructure/supabase/clients.js";
import { SupabaseRepositoryFactory } from "./infrastructure/SupabaseRepositoryFactory.js";
import { SupabaseTokenVerifier } from "./infrastructure/supabase/SupabaseTokenVerifier.js";
import { PostgresRateLimiter } from "./infrastructure/PostgresRateLimiter.js";

/** Everything the app needs, in one box. The routes and middleware read from this. */
export type Container = {
  config: Pick<Config, "NODE_ENV" | "FRONTEND_URL">;
  logger: Logger;
  verifier: TokenVerifier;          // checks login tokens
  limiter: RateLimiter;             // counts requests per user
  repositories: RepositoryFactory;  // builds database readers/writers for one user
  servicesFor: (viewer: Viewer) => Services; // builds all services for the person calling
};

/** Helpers shared by every request (not tied to one user's login), so we create them once. */
export type Shared = { guides: GuideRepository; llm: LlmClient | null; logger: Logger; deleter: AccountDeleter };

/**
 * Builds every service for ONE caller. Each service gets only the small interfaces it needs
 * (Interface Segregation) and, where it makes decisions about permissions, the viewer (who is calling).
 */
export function buildServices(repositories: RepositoryFactory, viewer: Viewer, shared: Shared): Services {
  const r = repositories.for(viewer); // database helpers that run AS this user
  return {
    experiences: new ExperienceService(r.experiences, viewer),
    me: new MeService(r.profiles, r.profileWriter),
    submissions: new SubmissionService(r.experienceWriter),
    lifecycle: new LifecycleService(r.experienceWriter),
    interactions: new InteractionService(r.interactions),
    reports: new ReportService(r.reports),
    mine: new MyContentService(r.mine),
    moderation: new ModerationService(r.moderation, r.adminQueue, viewer),
    companies: new CompanyService(r.companies),
    guides: new GuideService(r.guideSources, shared.guides, shared.llm, shared.logger),
    companyAdmin: new CompanyAdminService(r.companyAdmin, viewer),
    updates: new UpdateService(r.experienceWriter),
    adminOps: new AdminOpsService(r.updateReview, r.reportQueue, r.adminPost, viewer),
    account: new AccountService(shared.deleter, viewer),
    adminRoles: new AdminRoleService(r.adminRoles, viewer),
  };
}

/** Builds the real, production container: real Supabase, real Gemini, real rate limiter. */
export function createContainer(config: Config): Container {
  const repositories = new SupabaseRepositoryFactory(config);
  const logger = createLogger(config.LOG_LEVEL);
  const service = createServiceClient(config); // the powerful "system" connection, used only for a few system tasks
  // AI client with a backup plan (Decorator pattern): one Gemini client per model, wrapped so that if the first
  // model fails, the next one is tried. No API key means no AI: only the guide endpoint answers 503; nothing else breaks.
  const llm = config.GEMINI_API_KEY
    ? new FallbackLlmClient(config.GEMINI_MODELS.split(",").map((m) => m.trim()).filter(Boolean).map((m) => new GeminiClient(config.GEMINI_API_KEY!, m)))
    : null;
  const shared: Shared = { guides: new SupabaseGuideRepository(service), llm, logger, deleter: new SupabaseAccountDeleter(service) };
  return {
    config,
    logger,
    verifier: new SupabaseTokenVerifier(createUserClient(config)),
    limiter: new PostgresRateLimiter(service),
    repositories,
    servicesFor: (viewer) => buildServices(repositories, viewer, shared),
  };
}
