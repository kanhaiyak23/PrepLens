export class CompanyController {
    list = async (req, res) => {
        res.json({ data: await req.ctx.services.companies.list(req.valid.query) });
    };
}
