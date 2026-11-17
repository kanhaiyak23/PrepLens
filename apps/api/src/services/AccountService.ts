import type { DeletionResult } from "@preplens/shared";
import type { AccountDeleter } from "../domain/ports.js";
import { AuthenticationError, ForbiddenError } from "../domain/errors.js";
import type { Viewer } from "../domain/viewer.js";

/**
 * Self-service account deletion (FR-12). The caller chooses: keep live posts (detached, forced anonymous) or delete everything.
 * Posts that are not live are deleted either way, because nobody could manage them afterwards.
 */
export class AccountService {
  constructor(private readonly deleter: AccountDeleter, private readonly viewer: Viewer) {}

  async delete(posts: "keep" | "delete"): Promise<DeletionResult> {
    if (this.viewer.kind !== "user") throw new AuthenticationError("Sign in to continue.");
    // Admin accounts cannot self-delete: the audit log must keep resolving to a person. The database refuses too.
    if (this.viewer.role === "admin") throw new ForbiddenError("Admin accounts cannot delete themselves.");
    return this.deleter.delete(this.viewer.id, posts === "keep");
  }
}
