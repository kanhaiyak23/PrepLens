import type { Request, Response } from "express";
import type { ReportDto } from "@preplens/shared";

/** `on` comes from the HTTP verb (PUT = on, DELETE = off), so the request cannot disagree with itself. */
export const setVote = (on: boolean) => async (req: Request, res: Response) => {
  const { id } = req.valid.params as { id: string };
  res.json({ data: await req.ctx.services.interactions.vote(id, on) });
};

export const setBookmark = (on: boolean) => async (req: Request, res: Response) => {
  const { id } = req.valid.params as { id: string };
  res.json({ data: await req.ctx.services.interactions.bookmark(id, on) });
};

export const report = async (req: Request, res: Response) => {
  const { id } = req.valid.params as { id: string };
  res.status(201).json({ data: await req.ctx.services.reports.report(id, req.valid.body as ReportDto) });
};
