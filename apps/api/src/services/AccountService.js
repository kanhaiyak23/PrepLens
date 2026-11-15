import { AuthenticationError, ForbiddenError } from "../domain/errors.js";
/**
 * Self-service account deletion (FR-12). The caller chooses: keep live posts (detached, forced anonymous) or delete everything.
 * Posts that are not live are deleted either way, because nobody could manage them afterwards.
 */
export class AccountService {
    deleter;
    viewer;
    constructor(deleter, viewer) {
        this.deleter = deleter;
        this.viewer = viewer;
    }
    async delete(posts) {
        if (this.viewer.kind !== "user")
            throw new AuthenticationError("Sign in to continue.");
        // Admin accounts cannot self-delete: the audit log must keep resolving to a person. The database refuses too.
        if (this.viewer.role === "admin")
            throw new ForbiddenError("Admin accounts cannot delete themselves.");
        return this.deleter.delete(this.viewer.id, posts === "keep");
    }
}
