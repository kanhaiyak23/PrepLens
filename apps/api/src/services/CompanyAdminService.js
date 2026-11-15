import { ForbiddenError, ValidationError } from "../domain/errors.js";
import { isAdmin } from "../domain/viewer.js";
/** Admin-only, checked here and in the database function (defence in depth). */
export class CompanyAdminService {
    writer;
    viewer;
    constructor(writer, viewer) {
        this.writer = writer;
        this.viewer = viewer;
    }
    async listPending() {
        this.guard();
        return this.writer.listPending();
    }
    async decide(slug, action, mergeInto) {
        this.guard();
        if (action === "merge" && !mergeInto)
            throw new ValidationError("Choose the company to merge into.", { mergeInto: "required" });
        return { result: await this.writer.decide(slug, action, mergeInto) };
    }
    guard() {
        if (!isAdmin(this.viewer))
            throw new ForbiddenError("Admins only.");
    }
}
