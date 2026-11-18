/**
 * controllers/GuideController.ts — THE "WAITERS" FOR THE AI GUIDE AND FOR COMPANY APPROVAL
 *
 * What it does:
 *   - GuideController: GET /companies/:slug/guide -> the AI prep guide for one company.
 *   - CompanyAdminController (admin): list new company names, and approve or merge them.
 *
 * System design: thin controllers (layered architecture) — input in, one service call, JSON out. All rules,
 * including "admins only", are in the services (and again in the database).
 */
import type { Request, Response } from "express";

export class GuideController {
  /** The AI guide. Built from real posts, cached, and every point cites its source posts. */
  get = async (req: Request, res: Response) => {
    const { slug } = req.valid.params as { slug: string };
    res.json({ data: await req.ctx.services.guides.getGuide(slug) });
  };
}

export class CompanyAdminController {
  /** GET /admin/companies/pending — company names students typed that are not approved yet. */
  listPending = async (req: Request, res: Response) => {
    res.json({ data: await req.ctx.services.companyAdmin.listPending() });
  };
  /** POST /admin/companies/:slug/approve | merge — approve it, or merge it into an existing company (removes duplicates). */
  decide = async (req: Request, res: Response) => {
    const { slug, action } = req.valid.params as { slug: string; action: "approve" | "merge" };
    const { mergeInto } = (req.valid.body ?? {}) as { mergeInto?: string };
    res.json({ data: await req.ctx.services.companyAdmin.decide(slug, action, mergeInto) });
  };
}
