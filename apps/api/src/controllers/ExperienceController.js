/** Controllers do four things only: read the viewer's services, call one method, shape the response. No rules here. */
export class ExperienceController {
    list = async (req, res) => {
        res.json(await req.ctx.services.experiences.getFeed(req.valid.query));
    };
    get = async (req, res) => {
        const { id } = req.valid.params;
        res.json({ data: await req.ctx.services.experiences.getById(id) });
    };
    submit = async (req, res) => {
        const result = await req.ctx.services.submissions.submit(req.valid.body);
        res.status(201).json({ data: result });
    };
    update = async (req, res) => {
        const { id } = req.valid.params;
        const result = await req.ctx.services.updates.update(id, req.valid.body);
        // 202 when the change waits for review, 200 when it was applied at once.
        res.status(result.result === "queued" ? 202 : 200).json({ data: result });
    };
    cancelUpdate = async (req, res) => {
        const { id } = req.valid.params;
        await req.ctx.services.updates.cancel(id);
        res.status(204).end();
    };
    unpublish = async (req, res) => {
        const { id } = req.valid.params;
        res.json({ data: await req.ctx.services.lifecycle.unpublish(id) });
    };
    republish = async (req, res) => {
        const { id } = req.valid.params;
        res.json({ data: await req.ctx.services.lifecycle.republish(id) });
    };
}
