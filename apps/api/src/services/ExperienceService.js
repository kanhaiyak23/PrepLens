import { NotFoundError } from "../domain/errors.js";
import { FeedSorts } from "../domain/model/FeedSort.js";
import { ExperienceLifecycle } from "../domain/model/ExperienceLifecycle.js";
import { isAdmin } from "../domain/viewer.js";
/** Application layer: orchestrates; knows nothing about HTTP or Supabase. */
export class ExperienceService {
    reader;
    viewer;
    constructor(reader, viewer) {
        this.reader = reader;
        this.viewer = viewer;
    }
    async getFeed(q) {
        const { cursor, limit, sort: sortName, ...filters } = q;
        const sort = FeedSorts.create(sortName);
        const after = cursor ? sort.after(cursor) : undefined;
        // Ask for one extra row: its existence answers hasMore without a second query (ADR-08).
        const rows = await this.reader.findPage({ ...filters, sort: sort.name, ...(after ? { after } : {}), limit: limit + 1 });
        const hasMore = rows.length > limit;
        const data = hasMore ? rows.slice(0, limit) : rows;
        const last = data.at(-1);
        return { data, page: { hasMore, nextCursor: hasMore && last ? sort.nextCursor(last) : null } };
    }
    async getById(id) {
        const found = await this.reader.findById(id);
        // The database already hides unpublished posts from everyone but the author and admins,
        // and answers "not found" for both cases so a hidden post's existence is not revealed.
        if (!found)
            throw new NotFoundError("Experience not found.");
        // The privileged view (author or admin) also says what they may do next, from the lifecycle state machine.
        if (found.status) {
            found.allowedActions = ExperienceLifecycle.actionsFor({ status: found.status, isOwner: Boolean(found.isOwner), isAdmin: isAdmin(this.viewer), hasPendingUpdate: Boolean(found.pendingUpdate) });
        }
        return found;
    }
}
