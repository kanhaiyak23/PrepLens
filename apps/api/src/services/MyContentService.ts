/**
 * services/MyContentService.ts — MY POSTS AND MY SAVED POSTS
 *
 * What it does:
 *   - listMine(): every post I wrote, in every status, so I can see what is pending, live or rejected (and why).
 *   - listBookmarks(): the posts I saved, newest saved first, one page at a time.
 *
 * System design:
 * - Privacy: bookmarks are private. The database security rules (RLS) only let a user read their own.
 * - Keyset pagination with the "limit + 1" trick; the cursor uses the time I saved the post plus its id.
 */
import type { BookmarkedCard, MyExperience, Page } from "@preplens/shared";
import type { MyContentReader } from "../domain/ports.js";
import { decodeCursor, encodeCursor } from "../lib/cursor.js";

export class MyContentService {
  constructor(private readonly reader: MyContentReader) {}

  listMine(): Promise<MyExperience[]> { return this.reader.listMine(); }

  async listBookmarks(q: { cursor?: string; limit: number }): Promise<Page<BookmarkedCard>> {
    const after = q.cursor ? decodeCursor(q.cursor) : undefined;
    const rows = await this.reader.listBookmarks({ ...(after ? { after: { at: after.createdAt, id: after.id } } : {}), limit: q.limit + 1 });
    const hasMore = rows.length > q.limit;
    const data = hasMore ? rows.slice(0, q.limit) : rows;
    const last = data.at(-1);
    return { data, page: { hasMore, nextCursor: hasMore && last ? encodeCursor({ createdAt: last.bookmarkedAt, id: last.id }) : null } };
  }
}
