import type { AdminMember } from "@preplens/shared";
import type { AdminAccount, AdminRoleWriter } from "../domain/ports.js";
import { ConflictError, ForbiddenError } from "../domain/errors.js";
import { isAdmin, type Viewer } from "../domain/viewer.js";

/**
 * Admins make other people admin, or remove admin access (ADR-31).
 * Single Responsibility: role management only. Dependency Inversion: it knows the AdminRoleWriter port, not Supabase.
 * Defence in depth: the obvious rules fail fast here with a clear message; the database function enforces all of them
 * again, including the ones only it can (the account exists, never zero admins, one change at a time).
 */
export class AdminRoleService {
  constructor(private readonly roles: AdminRoleWriter, private readonly viewer: Viewer) {}

  async list(): Promise<AdminMember[]> {
    const me = this.guard();
    return (await this.roles.list()).map((a) => this.member(a, me.id));
  }

  async grant(email: string): Promise<AdminMember> {
    const me = this.guard();
    if (email === me.email) throw new ConflictError("You are already an admin.");
    return this.member(await this.roles.grant(email), me.id);
  }

  async revoke(userId: string): Promise<AdminMember> {
    const me = this.guard();
    if (userId === me.id) throw new ForbiddenError("You cannot remove your own admin access. Ask another admin.");
    return this.member(await this.roles.revoke(userId), me.id);
  }

  private member(a: AdminAccount, selfId: string): AdminMember {
    return { ...a, isSelf: a.id === selfId };
  }

  private guard() {
    if (this.viewer.kind !== "user" || !isAdmin(this.viewer)) throw new ForbiddenError("Admins only.");
    return this.viewer;
  }
}
