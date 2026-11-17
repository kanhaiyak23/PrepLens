import type { PendingCompany } from "@preplens/shared";
import type { CompanyAdminWriter } from "../domain/ports.js";
import { ForbiddenError, ValidationError } from "../domain/errors.js";
import { isAdmin, type Viewer } from "../domain/viewer.js";

/** Admin-only, checked here and in the database function (defence in depth). */
export class CompanyAdminService {
  constructor(private readonly writer: CompanyAdminWriter, private readonly viewer: Viewer) {}

  async listPending(): Promise<PendingCompany[]> {
    this.guard();
    return this.writer.listPending();
  }

  async decide(slug: string, action: "approve" | "merge", mergeInto?: string): Promise<{ result: string }> {
    this.guard();
    if (action === "merge" && !mergeInto) throw new ValidationError("Choose the company to merge into.", { mergeInto: "required" });
    return { result: await this.writer.decide(slug, action, mergeInto) };
  }

  private guard() {
    if (!isAdmin(this.viewer)) throw new ForbiddenError("Admins only.");
  }
}
