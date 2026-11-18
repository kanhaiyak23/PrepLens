/**
 * services/AccountService.ts — DELETE MY ACCOUNT
 *
 * What it does: lets a signed-in student delete their own account. They choose:
 *   - "keep": their live posts stay up, but are detached from them and shown as anonymous;
 *   - "delete": all their posts are deleted too.
 * Posts that are not live (pending, rejected...) are deleted either way, because nobody could manage them afterwards.
 *
 * System design:
 * - Privacy / right to be forgotten: users control their own data.
 * - Dependency Inversion: the service only knows the AccountDeleter interface, not how Supabase deletes a user.
 * - Audit integrity: admin accounts cannot delete themselves, so every row in the moderation log still points to a
 *   real person. The database refuses this too (defence in depth).
 */
import type { DeletionResult } from "@preplens/shared";
import type { AccountDeleter } from "../domain/ports.js";
import { AuthenticationError, ForbiddenError } from "../domain/errors.js";
import type { Viewer } from "../domain/viewer.js";

export class AccountService {
  constructor(private readonly deleter: AccountDeleter, private readonly viewer: Viewer) {}

  async delete(posts: "keep" | "delete"): Promise<DeletionResult> {
    if (this.viewer.kind !== "user") throw new AuthenticationError("Sign in to continue.");
    if (this.viewer.role === "admin") throw new ForbiddenError("Admin accounts cannot delete themselves.");
    return this.deleter.delete(this.viewer.id, posts === "keep"); // true = keep live posts as anonymous
  }
}
