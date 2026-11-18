/**
 * controllers/AdminController.ts — THE "WAITER" FOR ALL ADMIN SCREENS
 *
 * What it does: one method per admin endpoint. Each method reads the already-validated input, calls ONE service method,
 * and sends back the answer. It never decides anything itself.
 *
 * System design:
 * - Layered architecture: the controller only handles HTTP (input in, status code + JSON out).
 *   The business rules live in the services; the admin check already happened in the route (requireRole) and runs
 *   again inside each service (defence in depth).
 * - Command + Factory patterns: for approve/reject/remove/reinstate, the controller asks ModerationCommandFactory to build
 *   the right command object from the word in the URL, then hands that object to the service to run.
 * - HTTP status codes: 200 OK for reads and decisions, 201 Created when something new is created.
 */
import type { Request, Response } from "express";
import type { AdminPostDto, ExperienceStatus, GrantAdminDto, ModerationAction } from "@preplens/shared";
import { ModerationCommandFactory } from "../domain/ModerationCommand.js";

export class AdminController {
  /** GET /admin/experiences?status=pending — the review queue, one page at a time. */
  queue = async (req: Request, res: Response) => {
    res.json(await req.ctx.services.moderation.list(req.valid.query as { status: ExperienceStatus; cursor?: string; limit: number }));
  };

  /** POST /admin/experiences/:id/:action — approve, reject, remove or reinstate a post. */
  moderate = async (req: Request, res: Response) => {
    const { id, action } = req.valid.params as { id: string; action: ModerationAction };
    const { note } = (req.valid.body ?? {}) as { note?: string };
    const cmd = ModerationCommandFactory.create(action, id, note); // Factory builds e.g. an ApproveCommand
    res.json({ data: await req.ctx.services.moderation.execute(cmd) }); // the service runs the command
  };

  /** GET /admin/updates — edits to live posts that wait for approval. */
  updates = async (req: Request, res: Response) => {
    res.json({ data: await req.ctx.services.adminOps.listUpdates() });
  };

  /** POST /admin/experiences/:id/update/:action — approve or reject an edit. */
  decideUpdate = async (req: Request, res: Response) => {
    const { id, action } = req.valid.params as { id: string; action: "approve" | "reject" };
    const { note } = (req.valid.body ?? {}) as { note?: string };
    res.json({ data: await req.ctx.services.adminOps.decideUpdate(id, action, note) });
  };

  /** GET /admin/reports?status=open — posts that students reported. */
  reports = async (req: Request, res: Response) => {
    const { status } = req.valid.query as { status: "open" | "actioned" | "dismissed" };
    res.json({ data: await req.ctx.services.adminOps.listReports(status) });
  };

  /** POST /admin/reports/:id/dismiss — close a report without removing the post. */
  dismissReport = async (req: Request, res: Response) => {
    const { id } = req.valid.params as { id: string };
    res.json({ data: await req.ctx.services.adminOps.dismissReport(id) });
  };

  /** GET /admin/admins — list everyone who is an admin. */
  admins = async (req: Request, res: Response) => {
    res.json({ data: await req.ctx.services.adminRoles.list() });
  };

  /** POST /admin/admins { email } — make someone an admin. 201 = a new admin was created. */
  grantAdmin = async (req: Request, res: Response) => {
    const { email } = req.valid.body as GrantAdminDto;
    res.status(201).json({ data: await req.ctx.services.adminRoles.grant(email) });
  };

  /** DELETE /admin/admins/:id — remove someone's admin access. */
  revokeAdmin = async (req: Request, res: Response) => {
    const { id } = req.valid.params as { id: string };
    res.json({ data: await req.ctx.services.adminRoles.revoke(id) });
  };

  /** POST /admin/experiences — post an experience for a student (with their consent). */
  postOnBehalf = async (req: Request, res: Response) => {
    res.status(201).json({ data: await req.ctx.services.adminOps.postOnBehalf(req.valid.body as AdminPostDto) });
  };
}
