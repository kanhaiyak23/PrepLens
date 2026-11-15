import { decodeCursor, encodeCursor } from "../lib/cursor.js";
export class MyContentService {
    reader;
    constructor(reader) {
        this.reader = reader;
    }
    listMine() { return this.reader.listMine(); }
    async listBookmarks(q) {
        const after = q.cursor ? decodeCursor(q.cursor) : undefined;
        const rows = await this.reader.listBookmarks({ ...(after ? { after: { at: after.createdAt, id: after.id } } : {}), limit: q.limit + 1 });
        const hasMore = rows.length > q.limit;
        const data = hasMore ? rows.slice(0, q.limit) : rows;
        const last = data.at(-1);
        return { data, page: { hasMore, nextCursor: hasMore && last ? encodeCursor({ createdAt: last.bookmarkedAt, id: last.id }) : null } };
    }
}
