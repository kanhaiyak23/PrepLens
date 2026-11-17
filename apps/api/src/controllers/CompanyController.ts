import type { Request, Response } from "express";

export class CompanyController {
  list = async (req: Request, res: Response) => {
    res.json({ data: await req.ctx.services.companies.list(req.valid.query as { prefix?: string; limit: number }) });
  };
}
