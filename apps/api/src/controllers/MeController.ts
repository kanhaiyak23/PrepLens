import type { Request, Response } from "express";
import type { ProfileUpdateDto } from "@preplens/shared";

export class MeController {
  get = async (req: Request, res: Response) => {
    res.json({ data: await req.ctx.services.me.getMe() });
  };

  update = async (req: Request, res: Response) => {
    res.json({ data: await req.ctx.services.me.update(req.valid.body as ProfileUpdateDto) });
  };

  experiences = async (req: Request, res: Response) => {
    res.json({ data: await req.ctx.services.mine.listMine() });
  };

  bookmarks = async (req: Request, res: Response) => {
    res.json(await req.ctx.services.mine.listBookmarks(req.valid.query as { cursor?: string; limit: number }));
  };

  deleteAccount = async (req: Request, res: Response) => {
    const { posts } = req.valid.query as { posts: "keep" | "delete" };
    res.json({ data: await req.ctx.services.account.delete(posts) });
  };

  interactions = async (req: Request, res: Response) => {
    const { ids } = req.valid.query as { ids: string[] };
    res.json({ data: await req.ctx.services.interactions.state(ids) });
  };
}
