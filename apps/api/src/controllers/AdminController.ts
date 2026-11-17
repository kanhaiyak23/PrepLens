import type { Request, Response } from "express";
import type { AdminPostDto, ExperienceStatus, GrantAdminDto, ModerationAction } from "@preplens/shared";
import { ModerationCommandFactory } from "../domain/ModerationCommand.js";

export class AdminController {
  queue = async (req: Request, res: Response) => {
    res.json(await req.ctx.services.moderation.list(req.valid.query as { status: ExperienceStatus; cursor?: string; limit: number }));
  };

  moderate = async (req: Request, res: Response) => {
    const { id, action } = req.valid.params as { id: string; action: ModerationAction };
    const { note } = (req.valid.body ?? {}) as { note?: string };
    const cmd = ModerationCommandFactory.create(action, id, note);
    res.json({ data: await req.ctx.services.moderation.execute(cmd) });
  };

  updates = async (req: Request, res: Response) => {
    res.json({ data: await req.ctx.services.adminOps.listUpdates() });
  };

  decideUpdate = async (req: Request, res: Response) => {
    const { id, action } = req.valid.params as { id: string; action: "approve" | "reject" };
    const { note } = (req.valid.body ?? {}) as { note?: string };
    res.json({ data: await req.ctx.services.adminOps.decideUpdate(id, action, note) });
  };

  reports = async (req: Request, res: Response) => {
    const { status } = req.valid.query as { status: "open" | "actioned" | "dismissed" };
    res.json({ data: await req.ctx.services.adminOps.listReports(status) });
  };

  dismissReport = async (req: Request, res: Response) => {
    const { id } = req.valid.params as { id: string };
    res.json({ data: await req.ctx.services.adminOps.dismissReport(id) });
  };

  admins = async (req: Request, res: Response) => {
    res.json({ data: await req.ctx.services.adminRoles.list() });
  };

  grantAdmin = async (req: Request, res: Response) => {
    const { email } = req.valid.body as GrantAdminDto;
    res.status(201).json({ data: await req.ctx.services.adminRoles.grant(email) });
  };

  revokeAdmin = async (req: Request, res: Response) => {
    const { id } = req.valid.params as { id: string };
    res.json({ data: await req.ctx.services.adminRoles.revoke(id) });
  };

  postOnBehalf = async (req: Request, res: Response) => {
    res.status(201).json({ data: await req.ctx.services.adminOps.postOnBehalf(req.valid.body as AdminPostDto) });
  };
}
