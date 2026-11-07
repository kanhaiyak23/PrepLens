import { Router } from "express";
import {
  accountDeletionQuery, adminPostSchema, adminQueueQuery, experienceUpdateSchema, reportQueueQuery, updateDecisionParams, companyDecisionBody, companyDecisionParams, companyQuery, slugParam, feedQuerySchema, interactionsQuery, moderationBody, moderationParams, pageQuery,
  profileUpdateSchema, reportSchema, submissionSchema, uuidParam,
} from "@preplens/shared";
import type { Container } from "../container.js";
import { authenticate, requireRole } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { cacheUnlessSignedIn, noStore, publicCache } from "../middleware/cache.js";
import { ExperienceController } from "../controllers/ExperienceController.js";
import { MeController } from "../controllers/MeController.js";
import { AdminController } from "../controllers/AdminController.js";
import { CompanyController } from "../controllers/CompanyController.js";
import { report, setBookmark, setVote } from "../controllers/InteractionController.js";
import { CompanyAdminController, GuideController } from "../controllers/GuideController.js";

const DAY = 86_400;

/**
 * The versioned surface (/api/v1). Each route reads top to bottom as its own middleware chain:
 * who (authenticate) -> may they (role) -> how often (rateLimit) -> is the input valid -> do it.
 * Limits follow docs/design/02 ADR-11 and are keyed on the user.
 */
export function v1Router(c: Container): Router {
  const r = Router();
  const experiences = new ExperienceController();
  const me = new MeController();
  const admin = new AdminController();
  const companies = new CompanyController();
  const guides = new GuideController();
  const companyAdmin = new CompanyAdminController();
  const signedIn = [authenticate(c, "required"), noStore];
  const adminOnly = [authenticate(c, "required"), requireRole("admin"), noStore];

  // public reads (identical for every caller, so cacheable: ADR-09)
  r.get("/experiences", authenticate(c, "optional"), publicCache(), validate({ query: feedQuerySchema }), experiences.list);
  r.get("/experiences/:id", authenticate(c, "optional"), cacheUnlessSignedIn, validate({ params: uuidParam }), experiences.get);
  r.get("/companies", authenticate(c, "optional"), publicCache(300), validate({ query: companyQuery }), companies.list);

  // AI prep guide: identical for every caller, so cacheable. 20 per 10 minutes per user, 200 for signed-out readers (they share addresses).
  r.get("/companies/:slug/guide", authenticate(c, "optional"), rateLimit(c, "guide", { user: 20, visitor: 200 }, 600), publicCache(300, 600), validate({ params: slugParam }), guides.get);

  // the author's controls
  r.post("/experiences", ...signedIn, rateLimit(c, "submit", 5, DAY), validate({ body: submissionSchema }), experiences.submit);
  r.patch("/experiences/:id", ...signedIn, rateLimit(c, "edit", 20, 3600), validate({ params: uuidParam, body: experienceUpdateSchema }), experiences.update);
  r.delete("/experiences/:id/update", ...signedIn, validate({ params: uuidParam }), experiences.cancelUpdate);
  r.post("/experiences/:id/unpublish", ...signedIn, rateLimit(c, "lifecycle", 30, 3600), validate({ params: uuidParam }), experiences.unpublish);
  r.post("/experiences/:id/republish", ...signedIn, rateLimit(c, "lifecycle", 30, 3600), validate({ params: uuidParam }), experiences.republish);

  // votes, bookmarks, reports: PUT/DELETE are idempotent (ADR-07)
  const interact = [...signedIn, rateLimit(c, "interact", 60, 60), validate({ params: uuidParam })];
  r.put("/experiences/:id/vote", ...interact, setVote(true));
  r.delete("/experiences/:id/vote", ...interact, setVote(false));
  r.put("/experiences/:id/bookmark", ...interact, setBookmark(true));
  r.delete("/experiences/:id/bookmark", ...interact, setBookmark(false));
  r.post("/experiences/:id/reports", ...signedIn, rateLimit(c, "report", 10, DAY), validate({ params: uuidParam, body: reportSchema }), report);

  // the signed-in user
  r.get("/me", ...signedIn, me.get);
  r.patch("/me", ...signedIn, rateLimit(c, "profile", 30, 3600), validate({ body: profileUpdateSchema }), me.update);
  r.delete("/me", ...signedIn, rateLimit(c, "delete-account", 3, DAY), validate({ query: accountDeletionQuery }), me.deleteAccount);
  r.get("/me/experiences", ...signedIn, me.experiences);
  r.get("/me/bookmarks", ...signedIn, validate({ query: pageQuery }), me.bookmarks);
  r.get("/me/interactions", ...signedIn, validate({ query: interactionsQuery }), me.interactions);

  // admin
  r.get("/admin/experiences", ...adminOnly, validate({ query: adminQueueQuery }), admin.queue);
  r.get("/admin/updates", ...adminOnly, admin.updates);
  r.post("/admin/experiences/:id/update/:action", ...adminOnly, validate({ params: updateDecisionParams, body: moderationBody }), admin.decideUpdate);
  r.get("/admin/reports", ...adminOnly, validate({ query: reportQueueQuery }), admin.reports);
  r.post("/admin/reports/:id/dismiss", ...adminOnly, validate({ params: uuidParam }), admin.dismissReport);
  r.post("/admin/experiences", ...adminOnly, validate({ body: adminPostSchema }), admin.postOnBehalf);
  r.post("/admin/experiences/:id/:action", ...adminOnly, validate({ params: moderationParams, body: moderationBody }), admin.moderate);
  r.get("/admin/companies/pending", ...adminOnly, companyAdmin.listPending);
  r.post("/admin/companies/:slug/:action", ...adminOnly, validate({ params: companyDecisionParams, body: companyDecisionBody }), companyAdmin.decide);
  return r;
}
