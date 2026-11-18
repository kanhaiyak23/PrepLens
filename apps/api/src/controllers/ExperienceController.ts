/**
 * controllers/ExperienceController.ts — THE "WAITER" FOR POSTS (EXPERIENCES)
 *
 * What it does: handles the feed, one post, submitting a post, editing it, cancelling an edit,
 * and the author's unpublish / republish buttons.
 *
 * System design:
 * - Thin controller (layered architecture): read the validated input, call ONE service method, choose the status code.
 *   No business rules here, so the rules can be tested without HTTP.
 * - Meaningful HTTP status codes: 201 Created (new post), 202 Accepted (edit is waiting for admin review),
 *   200 OK (done now), 204 No Content (done, nothing to return).
 */
import type { Request, Response } from "express";
import type { ExperienceUpdateDto, FeedQuery, SubmissionDto } from "@preplens/shared";

export class ExperienceController {
  /** GET /experiences — the public feed with search, filters, sort and paging. */
  list = async (req: Request, res: Response) => {
    res.json(await req.ctx.services.experiences.getFeed(req.valid.query as FeedQuery));
  };

  /** GET /experiences/:id — one post, plus which buttons this viewer may use. */
  get = async (req: Request, res: Response) => {
    const { id } = req.valid.params as { id: string };
    res.json({ data: await req.ctx.services.experiences.getById(id) });
  };

  /** POST /experiences — submit a new post. It starts as "pending" until an admin approves it. */
  submit = async (req: Request, res: Response) => {
    const result = await req.ctx.services.submissions.submit(req.valid.body as SubmissionDto);
    res.status(201).json({ data: result });
  };

  /** PATCH /experiences/:id — edit my post. */
  update = async (req: Request, res: Response) => {
    const { id } = req.valid.params as { id: string };
    const result = await req.ctx.services.updates.update(id, req.valid.body as ExperienceUpdateDto);
    // 202 = "accepted, waiting for admin review" (editing a live post); 200 = "applied now" (post not live yet).
    res.status(result.result === "queued" ? 202 : 200).json({ data: result });
  };

  /** DELETE /experiences/:id/update — withdraw my edit that is waiting for review. */
  cancelUpdate = async (req: Request, res: Response) => {
    const { id } = req.valid.params as { id: string };
    await req.ctx.services.updates.cancel(id);
    res.status(204).end();
  };

  /** POST /experiences/:id/unpublish — the author hides their post instantly. */
  unpublish = async (req: Request, res: Response) => {
    const { id } = req.valid.params as { id: string };
    res.json({ data: await req.ctx.services.lifecycle.unpublish(id) });
  };

  /** POST /experiences/:id/republish — the author brings it back (it goes through review again). */
  republish = async (req: Request, res: Response) => {
    const { id } = req.valid.params as { id: string };
    res.json({ data: await req.ctx.services.lifecycle.republish(id) });
  };
}
