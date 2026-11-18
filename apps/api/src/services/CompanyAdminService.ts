/**
 * services/CompanyAdminService.ts — APPROVE OR MERGE NEW COMPANY NAMES (admins only)
 *
 * What it does: when a student types a company PrepLens doesn't know yet, it is saved as "pending".
 * An admin then either approves it, or merges it into an existing company (e.g. "Amazon India" into "Amazon").
 * On merge, all posts move to the right company and the old name is kept as an alias for future searches.
 *
 * System design:
 * - Data normalisation: one company = one row, so company pages and AI guides don't split across duplicates.
 * - Defence in depth: the admin check runs here and again in the database function.
 * - Fail fast: "merge" without saying which company to merge into is refused before calling the database.
 * - Atomic operation: the merge itself (move posts, add alias, recount, delete duplicate) is ONE database transaction.
 */
import type { PendingCompany } from "@preplens/shared";
import type { CompanyAdminWriter } from "../domain/ports.js";
import { ForbiddenError, ValidationError } from "../domain/errors.js";
import { isAdmin, type Viewer } from "../domain/viewer.js";

export class CompanyAdminService {
  constructor(private readonly writer: CompanyAdminWriter, private readonly viewer: Viewer) {}

  /** Company names waiting for an admin. */
  async listPending(): Promise<PendingCompany[]> {
    this.guard();
    return this.writer.listPending();
  }

  /** "approve" makes the company active; "merge" folds it into `mergeInto`. */
  async decide(slug: string, action: "approve" | "merge", mergeInto?: string): Promise<{ result: string }> {
    this.guard();
    if (action === "merge" && !mergeInto) throw new ValidationError("Choose the company to merge into.", { mergeInto: "required" });
    return { result: await this.writer.decide(slug, action, mergeInto) };
  }

  private guard() {
    if (!isAdmin(this.viewer)) throw new ForbiddenError("Admins only.");
  }
}
