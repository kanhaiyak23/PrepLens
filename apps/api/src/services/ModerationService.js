import { ForbiddenError } from "../domain/errors.js";
import { isAdmin } from "../domain/viewer.js";
import { decodeCursor, encodeCursor } from "../lib/cursor.js";
/**
 * Runs a command and lists the queue. Admin-only twice over: the route requires the role, this service
 * checks again, and the database function checks a third time (defence in depth, ADR-04).
 */
export class ModerationService {
    writer;
    queue;
    viewer;
    constructor(writer, queue, viewer) {
        this.writer = writer;
        this.queue = queue;
        this.viewer = viewer;
    }
    async execute(cmd) {
        this.assertAdmin();
        return { status: await cmd.run(this.writer) };
    }
    async list(q) {
        this.assertAdmin();
        const after = q.cursor ? decodeCursor(q.cursor) : undefined;
        const rows = await this.queue.list({ status: q.status, ...(after ? { after: { at: after.createdAt, id: after.id } } : {}), limit: q.limit + 1 });
        const hasMore = rows.length > q.limit;
        const data = hasMore ? rows.slice(0, q.limit) : rows;
        const last = data.at(-1);
        return { data, page: { hasMore, nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null } };
    }
    assertAdmin() {
        if (!isAdmin(this.viewer))
            throw new ForbiddenError("Admins only.");
    }
}
