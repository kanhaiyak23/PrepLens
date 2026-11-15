export class GuideController {
    get = async (req, res) => {
        const { slug } = req.valid.params;
        res.json({ data: await req.ctx.services.guides.getGuide(slug) });
    };
}
export class CompanyAdminController {
    listPending = async (req, res) => {
        res.json({ data: await req.ctx.services.companyAdmin.listPending() });
    };
    decide = async (req, res) => {
        const { slug, action } = req.valid.params;
        const { mergeInto } = (req.valid.body ?? {});
        res.json({ data: await req.ctx.services.companyAdmin.decide(slug, action, mergeInto) });
    };
}
