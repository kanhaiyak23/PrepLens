/**
 * services/ExperienceService.ts — THE FEED AND A SINGLE POST
 *
 * What it does:
 *   - getFeed(): the list of published posts with search, filters, sorting and paging.
 *   - getById(): one post. For its author or an admin, it also lists which buttons they may use now
 *     (edit, unpublish, approve...), worked out from the post's state machine.
 *
 * System design:
 * - Application layer: it coordinates domain objects and the reader; it knows nothing about HTTP or Supabase.
 * - Strategy pattern: FeedSorts.create(name) picks the sort (newest first, or by interview date). Each strategy
 *   knows how to build its own page cursor, so the service has no "if sort === ..." code.
 * - Keyset pagination (ADR-08): asks for limit + 1 rows. If the extra row exists, there is a next page —
 *   no second "count" query is needed.
 * - State machine: ExperienceLifecycle decides the allowed actions, so the website never guesses which buttons to show.
 * - Privacy: a hidden post answers "not found" (not "forbidden"), so nobody can even tell it exists.
 * - Immutability: returns a new object instead of changing the one the reader gave back.
 */
import type { ExperienceCard, ExperienceDetail, FeedQuery, Page } from "@preplens/shared";
import type { ExperienceReader } from "../domain/ports.js";
import { NotFoundError } from "../domain/errors.js";
import { FeedSorts } from "../domain/model/FeedSort.js";
import { ExperienceLifecycle } from "../domain/model/ExperienceLifecycle.js";
import { isAdmin, type Viewer } from "../domain/viewer.js";

export class ExperienceService {
  constructor(private readonly reader: ExperienceReader, private readonly viewer: Viewer) {}

  async getFeed(q: FeedQuery): Promise<Page<ExperienceCard>> {
    const { cursor, limit, sort: sortName, ...filters } = q;
    const sort = FeedSorts.create(sortName);              // Strategy: newest-first or interview-date-first
    const after = cursor ? sort.after(cursor) : undefined; // "continue after this item" (checked for tampering)
    // Ask for ONE extra row: if it comes back, there is another page.
    const rows = await this.reader.findPage({ ...filters, sort: sort.name, ...(after ? { after } : {}), limit: limit + 1 });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data.at(-1);
    return { data, page: { hasMore, nextCursor: hasMore && last ? sort.nextCursor(last) : null } };
  }

  async getById(id: string): Promise<ExperienceDetail> {
    const found = await this.reader.findById(id);
    // The database shows an unpublished post only to its author and admins. For everyone else it is simply
    // "not found", so a hidden post's existence is never revealed.
    if (!found) throw new NotFoundError("Experience not found.");
    // Only the author/admin view includes the status. If there is one, add the actions allowed from this state.
    if (!found.status) return found;
    return { ...found, allowedActions: ExperienceLifecycle.actionsFor({ status: found.status, isOwner: Boolean(found.isOwner), isAdmin: isAdmin(this.viewer), hasPendingUpdate: Boolean(found.pendingUpdate) }) };
  }
}
