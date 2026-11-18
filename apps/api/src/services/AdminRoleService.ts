/**
 * services/AdminRoleService.ts — MAKE SOMEONE ADMIN, OR REMOVE ADMIN ACCESS (ADR-31)
 *
 * What it does (admins only):
 *   - list(): everyone who is an admin, with "isSelf" marking you, so the screen can show a "You" badge;
 *   - grant(email): make that person an admin (they must have signed in once);
 *   - revoke(userId): remove that person's admin access.
 *
 * Rules: you cannot remove your own access, you cannot "grant" yourself, and the last admin can never be removed.
 *
 * System design:
 * - Single Responsibility: this service does role management and nothing else.
 * - Dependency Inversion: it talks to the AdminRoleWriter interface, never to Supabase directly.
 * - Defence in depth: the simple rules fail fast here with a clear message. The database function checks ALL of them
 *   again, plus the ones only the database can check safely: the account exists, never zero admins, and only one
 *   role change at a time (a lock), so two admins removing each other at the same moment can't leave zero admins.
 */
import type { AdminMember } from "@preplens/shared";
import type { AdminAccount, AdminRoleWriter } from "../domain/ports.js";
import { ConflictError, ForbiddenError } from "../domain/errors.js";
import { isAdmin, type Viewer } from "../domain/viewer.js";

export class AdminRoleService {
  constructor(private readonly roles: AdminRoleWriter, private readonly viewer: Viewer) {}

  /** All admins; the caller's own row is marked isSelf. */
  async list(): Promise<AdminMember[]> {
    const me = this.guard();
    return (await this.roles.list()).map((a) => this.member(a, me.id));
  }

  /** Make someone admin by their email. Your own email -> 409 "already an admin". */
  async grant(email: string): Promise<AdminMember> {
    const me = this.guard();
    if (email === me.email) throw new ConflictError("You are already an admin.");
    return this.member(await this.roles.grant(email), me.id);
  }

  /** Remove someone's admin access. Your own id -> 403 (prevents locking yourself out by accident). */
  async revoke(userId: string): Promise<AdminMember> {
    const me = this.guard();
    if (userId === me.id) throw new ForbiddenError("You cannot remove your own admin access. Ask another admin.");
    return this.member(await this.roles.revoke(userId), me.id);
  }

  /** Adds isSelf = "is this row the person calling?" */
  private member(a: AdminAccount, selfId: string): AdminMember {
    return { ...a, isSelf: a.id === selfId };
  }

  /** Only a signed-in admin gets past this line. Returns the caller so the rules above can compare ids. */
  private guard() {
    if (this.viewer.kind !== "user" || !isAdmin(this.viewer)) throw new ForbiddenError("Admins only.");
    return this.viewer;
  }
}
