/**
 * controllers/InteractionController.ts — THE "WAITER" FOR VOTES, BOOKMARKS AND REPORTS
 *
 * What it does: upvote / remove vote, save / unsave a post, and report a post.
 *
 * System design:
 * - Idempotent API design: the HTTP verb itself says the wanted state. PUT = "make it ON", DELETE = "make it OFF".
 *   Sending the same request twice gives the same result, so double-clicks and network retries can never
 *   create two votes. (The database also has a unique rule: one vote per person per post.)
 * - Higher-order functions: setVote(true) and setVote(false) build two handlers from one piece of code (no duplication).
 */
import type { Request, Response } from "express";
import type { ReportDto } from "@preplens/shared";

/** setVote(true) for PUT (vote), setVote(false) for DELETE (remove vote). The verb decides, so the request can't contradict itself. */
export const setVote = (on: boolean) => async (req: Request, res: Response) => {
  const { id } = req.valid.params as { id: string };
  res.json({ data: await req.ctx.services.interactions.vote(id, on) });
};

/** Same idea for bookmarks (saved posts). Bookmarks are private: only the owner can see them. */
export const setBookmark = (on: boolean) => async (req: Request, res: Response) => {
  const { id } = req.valid.params as { id: string };
  res.json({ data: await req.ctx.services.interactions.bookmark(id, on) });
};

/** POST /experiences/:id/reports — flag a post for admins to look at. 201 = a new report was created. */
export const report = async (req: Request, res: Response) => {
  const { id } = req.valid.params as { id: string };
  res.status(201).json({ data: await req.ctx.services.reports.report(id, req.valid.body as ReportDto) });
};
