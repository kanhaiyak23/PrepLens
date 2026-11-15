/** `on` comes from the HTTP verb (PUT = on, DELETE = off), so the request cannot disagree with itself. */
export const setVote = (on) => async (req, res) => {
    const { id } = req.valid.params;
    res.json({ data: await req.ctx.services.interactions.vote(id, on) });
};
export const setBookmark = (on) => async (req, res) => {
    const { id } = req.valid.params;
    res.json({ data: await req.ctx.services.interactions.bookmark(id, on) });
};
export const report = async (req, res) => {
    const { id } = req.valid.params;
    res.status(201).json({ data: await req.ctx.services.reports.report(id, req.valid.body) });
};
