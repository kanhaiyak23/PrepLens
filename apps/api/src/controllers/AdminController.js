import { ModerationCommandFactory } from "../domain/ModerationCommand.js";
export class AdminController {
    queue = async (req, res) => {
        res.json(await req.ctx.services.moderation.list(req.valid.query));
    };
    moderate = async (req, res) => {
        const { id, action } = req.valid.params;
        const { note } = (req.valid.body ?? {});
        const cmd = ModerationCommandFactory.create(action, id, note);
        res.json({ data: await req.ctx.services.moderation.execute(cmd) });
    };
    updates = async (req, res) => {
        res.json({ data: await req.ctx.services.adminOps.listUpdates() });
    };
    decideUpdate = async (req, res) => {
        const { id, action } = req.valid.params;
        const { note } = (req.valid.body ?? {});
        res.json({ data: await req.ctx.services.adminOps.decideUpdate(id, action, note) });
    };
    reports = async (req, res) => {
        const { status } = req.valid.query;
        res.json({ data: await req.ctx.services.adminOps.listReports(status) });
    };
    dismissReport = async (req, res) => {
        const { id } = req.valid.params;
        res.json({ data: await req.ctx.services.adminOps.dismissReport(id) });
    };
    postOnBehalf = async (req, res) => {
        res.status(201).json({ data: await req.ctx.services.adminOps.postOnBehalf(req.valid.body) });
    };
}
