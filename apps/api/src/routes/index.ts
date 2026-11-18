/**
 * routes/index.ts — THE MENU: EVERY URL THE API ANSWERS
 *
 * What it does: lists every endpoint under /api/v1. For each one it says, in order:
 *   who are you (authenticate) -> are you allowed (requireRole) -> not too often (rateLimit)
 *   -> is the input valid (validate) -> do the work (controller).
 *
 * System design:
 * - REST API: nouns in the URL (experiences, companies, me, admin) and the HTTP verb says the action
 *   (GET read, POST create, PATCH change, PUT set, DELETE remove).
 * - Middleware pipeline (Chain of Responsibility): each check runs in turn and can stop the request early.
 *   Reading one line tells you exactly what protects that endpoint.
 * - Rate limits per user, not per IP (ADR-11), because a whole campus shares one Wi-Fi IP.
 * - Caching only where the answer is the same for everyone (ADR-09); private and admin data is never cached.
 * - Shared validation schemas come from @preplens/shared, so the website and API use the SAME rules (single source of truth).
 */
import { Router } from "express";
import {
  accountDeletionQuery, adminPostSchema, adminQueueQuery, experienceUpdateSchema, reportQueueQuery, updateDecisionParams, companyDecisionBody, companyDecisionParams, companyQuery, slugParam, feedQuerySchema, interactionsQuery, moderationBody, moderationParams, pageQuery,
  grantAdminSchema, profileUpdateSchema, reportSchema, submissionSchema, uuidParam,
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

const DAY = 86_400; // seconds in a day, used for daily limits

export function v1Router(c: Container): Router {
  const r = Router();
  const experiences = new ExperienceController();
  const me = new MeController();
  const admin = new AdminController();
  const companies = new CompanyController();
  const guides = new GuideController();
  const companyAdmin = new CompanyAdminController();
  // Reusable guard chains:
  const signedIn = [authenticate(c, "required"), noStore];                              // must be signed in; never cache
  const adminOnly = [authenticate(c, "required"), requireRole("admin"), noStore];      // must be signed in AND an admin

  // ---- PUBLIC READS: anyone can read published posts. The answer is the same for everyone, so it can be cached.
  r.get("/experiences", authenticate(c, "optional"), publicCache(), validate({ query: feedQuerySchema }), experiences.list);   // the feed (search, filters, paging)
  r.get("/experiences/:id", authenticate(c, "optional"), cacheUnlessSignedIn, validate({ params: uuidParam }), experiences.get); // one post
  r.get("/companies", authenticate(c, "optional"), publicCache(300), validate({ query: companyQuery }), companies.list);         // company list

  // ---- AI PREP GUIDE: same for everyone, so cacheable. 20 per 10 minutes per signed-in user; 200 for signed-out readers (they share an IP).
  r.get("/companies/:slug/guide", authenticate(c, "optional"), rateLimit(c, "guide", { user: 20, visitor: 200 }, 600), publicCache(300, 600), validate({ params: slugParam }), guides.get);

  // ---- AUTHOR ACTIONS: post, edit, cancel an edit, unpublish, republish.
  r.post("/experiences", ...signedIn, rateLimit(c, "submit", 5, DAY), validate({ body: submissionSchema }), experiences.submit);   // max 5 posts a day
  r.patch("/experiences/:id", ...signedIn, rateLimit(c, "edit", 20, 3600), validate({ params: uuidParam, body: experienceUpdateSchema }), experiences.update);
  r.delete("/experiences/:id/update", ...signedIn, validate({ params: uuidParam }), experiences.cancelUpdate);
  r.post("/experiences/:id/unpublish", ...signedIn, rateLimit(c, "lifecycle", 30, 3600), validate({ params: uuidParam }), experiences.unpublish);
  r.post("/experiences/:id/republish", ...signedIn, rateLimit(c, "lifecycle", 30, 3600), validate({ params: uuidParam }), experiences.republish);

  // ---- VOTES, BOOKMARKS, REPORTS.
  // PUT = "turn it on", DELETE = "turn it off". Both are idempotent (ADR-07): doing it twice has the same result as once,
  // so a double-click or a retry can never create two votes.
  const interact = [...signedIn, rateLimit(c, "interact", 60, 60), validate({ params: uuidParam })]; // 60 per minute
  r.put("/experiences/:id/vote", ...interact, setVote(true));
  r.delete("/experiences/:id/vote", ...interact, setVote(false));
  r.put("/experiences/:id/bookmark", ...interact, setBookmark(true));
  r.delete("/experiences/:id/bookmark", ...interact, setBookmark(false));
  r.post("/experiences/:id/reports", ...signedIn, rateLimit(c, "report", 10, DAY), validate({ params: uuidParam, body: reportSchema }), report); // 10 reports a day

  // ---- THE SIGNED-IN USER ("me"): profile, my posts, my bookmarks, delete my account.
  r.get("/me", ...signedIn, me.get);
  r.patch("/me", ...signedIn, rateLimit(c, "profile", 30, 3600), validate({ body: profileUpdateSchema }), me.update);
  r.delete("/me", ...signedIn, rateLimit(c, "delete-account", 3, DAY), validate({ query: accountDeletionQuery }), me.deleteAccount);
  r.get("/me/experiences", ...signedIn, me.experiences);
  r.get("/me/bookmarks", ...signedIn, validate({ query: pageQuery }), me.bookmarks);
  r.get("/me/interactions", ...signedIn, validate({ query: interactionsQuery }), me.interactions); // which posts I voted on / saved

  // ---- ADMIN: every route here goes through adminOnly (signed in + admin role read from the database).
  r.get("/admin/experiences", ...adminOnly, validate({ query: adminQueueQuery }), admin.queue);                    // review queue
  r.get("/admin/updates", ...adminOnly, admin.updates);                                                            // edits waiting
  r.post("/admin/experiences/:id/update/:action", ...adminOnly, validate({ params: updateDecisionParams, body: moderationBody }), admin.decideUpdate);
  r.get("/admin/reports", ...adminOnly, validate({ query: reportQueueQuery }), admin.reports);                     // reported posts
  r.post("/admin/reports/:id/dismiss", ...adminOnly, validate({ params: uuidParam }), admin.dismissReport);
  r.post("/admin/experiences", ...adminOnly, validate({ body: adminPostSchema }), admin.postOnBehalf);             // post for a student
  r.post("/admin/experiences/:id/:action", ...adminOnly, validate({ params: moderationParams, body: moderationBody }), admin.moderate); // approve/reject/remove/reinstate
  // Admin roles (ADR-31): any admin can make someone admin or remove their access. Never their own, never the last admin.
  r.get("/admin/admins", ...adminOnly, admin.admins);
  r.post("/admin/admins", ...adminOnly, rateLimit(c, "admin-roles", 30, 3600), validate({ body: grantAdminSchema }), admin.grantAdmin);
  r.delete("/admin/admins/:id", ...adminOnly, rateLimit(c, "admin-roles", 30, 3600), validate({ params: uuidParam }), admin.revokeAdmin);
  r.get("/admin/companies/pending", ...adminOnly, companyAdmin.listPending);                                      // new company names
  r.post("/admin/companies/:slug/:action", ...adminOnly, validate({ params: companyDecisionParams, body: companyDecisionBody }), companyAdmin.decide);
  return r;
}
