/**
 * controllers/MeController.ts — THE "WAITER" FOR "MY ACCOUNT" PAGES
 *
 * What it does: my profile (read and update), my posts, my saved posts, which posts I voted on, and delete my account.
 *
 * System design:
 * - Thin controller (layered architecture): no rules here.
 * - "Me" endpoints never take a user id from the browser. The user is always the one in the verified login token,
 *   so nobody can read or change someone else's account by changing an id in the URL.
 */
import type { Request, Response } from "express";
import type { ProfileUpdateDto } from "@preplens/shared";

export class MeController {
  /** GET /me — my profile (name, batch, branch, role). */
  get = async (req: Request, res: Response) => {
    res.json({ data: await req.ctx.services.me.getMe() });
  };

  /** PATCH /me — change my batch or branch. */
  update = async (req: Request, res: Response) => {
    res.json({ data: await req.ctx.services.me.update(req.valid.body as ProfileUpdateDto) });
  };

  /** GET /me/experiences — all my posts, in every status (pending, published, rejected...). */
  experiences = async (req: Request, res: Response) => {
    res.json({ data: await req.ctx.services.mine.listMine() });
  };

  /** GET /me/bookmarks — my saved posts, one page at a time. */
  bookmarks = async (req: Request, res: Response) => {
    res.json(await req.ctx.services.mine.listBookmarks(req.valid.query as { cursor?: string; limit: number }));
  };

  /** DELETE /me?posts=keep|delete — delete my account; keep my posts (made anonymous) or delete them too. */
  deleteAccount = async (req: Request, res: Response) => {
    const { posts } = req.valid.query as { posts: "keep" | "delete" };
    res.json({ data: await req.ctx.services.account.delete(posts) });
  };

  /** GET /me/interactions?ids=... — for a list of posts, which ones I voted on and saved (to colour the buttons). */
  interactions = async (req: Request, res: Response) => {
    const { ids } = req.valid.query as { ids: string[] };
    res.json({ data: await req.ctx.services.interactions.state(ids) });
  };
}
