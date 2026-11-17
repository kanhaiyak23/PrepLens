import type { Request, Response } from "express";

export class GuideController {
  get = async (req: Request, res: Response) => {
    const { slug } = req.valid.params as { slug: string };
    res.json({ data: await req.ctx.services.guides.getGuide(slug) });
  };
}

export class CompanyAdminController {
  listPending = async (req: Request, res: Response) => {
    res.json({ data: await req.ctx.services.companyAdmin.listPending() });
  };
  decide = async (req: Request, res: Response) => {
    const { slug, action } = req.valid.params as { slug: string; action: "approve" | "merge" };
    const { mergeInto } = (req.valid.body ?? {}) as { mergeInto?: string };
    res.json({ data: await req.ctx.services.companyAdmin.decide(slug, action, mergeInto) });
  };
}
