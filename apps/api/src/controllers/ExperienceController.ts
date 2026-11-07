import type { Request, Response } from "express";
import type { ExperienceUpdateDto, FeedQuery, SubmissionDto } from "@preplens/shared";

/** Controllers do four things only: read the viewer's services, call one method, shape the response. No rules here. */
export class ExperienceController {
  list = async (req: Request, res: Response) => {
    res.json(await req.ctx.services.experiences.getFeed(req.valid.query as FeedQuery));
  };

  get = async (req: Request, res: Response) => {
    const { id } = req.valid.params as { id: string };
    res.json({ data: await req.ctx.services.experiences.getById(id) });
  };

  submit = async (req: Request, res: Response) => {
    const result = await req.ctx.services.submissions.submit(req.valid.body as SubmissionDto);
    res.status(201).json({ data: result });
  };

  update = async (req: Request, res: Response) => {
    const { id } = req.valid.params as { id: string };
    const result = await req.ctx.services.updates.update(id, req.valid.body as ExperienceUpdateDto);
    // 202 when the change waits for review, 200 when it was applied at once.
    res.status(result.result === "queued" ? 202 : 200).json({ data: result });
  };

  cancelUpdate = async (req: Request, res: Response) => {
    const { id } = req.valid.params as { id: string };
    await req.ctx.services.updates.cancel(id);
    res.status(204).end();
  };

  unpublish = async (req: Request, res: Response) => {
    const { id } = req.valid.params as { id: string };
    res.json({ data: await req.ctx.services.lifecycle.unpublish(id) });
  };

  republish = async (req: Request, res: Response) => {
    const { id } = req.valid.params as { id: string };
    res.json({ data: await req.ctx.services.lifecycle.republish(id) });
  };
}
