/**
 * controllers/CompanyController.ts — THE "WAITER" FOR THE COMPANY LIST
 *
 * What it does: GET /companies?prefix=am -> list of companies (used for the search box and filters).
 *
 * System design: thin controller (layered architecture) — read input, call the service, return JSON. No rules here.
 */
import type { Request, Response } from "express";

export class CompanyController {
  list = async (req: Request, res: Response) => {
    res.json({ data: await req.ctx.services.companies.list(req.valid.query as { prefix?: string; limit: number }) });
  };
}
