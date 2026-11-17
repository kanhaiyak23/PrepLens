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

/**
 * Composition root (Dependency Inversion): the only file that knows which concrete classes implement
 * the ports. Tests build the same Container with in-memory fakes, so no test needs a database.
 */
export type Container = {
  config: Pick<Config, "NODE_ENV" | "FRONTEND_URL">;
  logger: Logger;
  verifier: TokenVerifier;
  limiter: RateLimiter;
  repositories: RepositoryFactory;
  servicesFor: (viewer: Viewer) => Services;
};

/** Collaborators that are shared by every request (not tied to one user's token). */
export type Shared = { guides: GuideRepository; llm: LlmClient | null; logger: Logger; deleter: AccountDeleter };

export function buildServices(repositories: RepositoryFactory, viewer: Viewer, shared: Shared): Services {
  const r = repositories.for(viewer);
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

export function createContainer(config: Config): Container {
  const repositories = new SupabaseRepositoryFactory(config);
  const logger = createLogger(config.LOG_LEVEL);
  const service = createServiceClient(config);
  // The decorator wraps one adapter per configured model. No key means no LLM: the guide endpoint answers 503 and nothing else is affected.
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
