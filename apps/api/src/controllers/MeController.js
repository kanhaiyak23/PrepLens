export class MeController {
    get = async (req, res) => {
        res.json({ data: await req.ctx.services.me.getMe() });
    };
    update = async (req, res) => {
        res.json({ data: await req.ctx.services.me.update(req.valid.body) });
    };
    experiences = async (req, res) => {
        res.json({ data: await req.ctx.services.mine.listMine() });
    };
    bookmarks = async (req, res) => {
        res.json(await req.ctx.services.mine.listBookmarks(req.valid.query));
    };
    deleteAccount = async (req, res) => {
        const { posts } = req.valid.query;
        res.json({ data: await req.ctx.services.account.delete(posts) });
    };
    interactions = async (req, res) => {
        const { ids } = req.valid.query;
        res.json({ data: await req.ctx.services.interactions.state(ids) });
    };
}
