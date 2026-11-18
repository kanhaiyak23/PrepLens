/**
 * services/ModerationService.ts — APPROVE, REJECT, REMOVE, REINSTATE (admins only)
 *
 * What it does:
 *   - execute(cmd): runs one moderation command (e.g. ApproveCommand) built by the controller.
 *   - list(): the review queue for a status (e.g. all "pending" posts), one page at a time.
 *
 * System design:
 * - Command pattern: the service doesn't know which action it is running; it just calls cmd.run().
 *   Adding a new action needs a new command class, not a change here (Open/Closed principle).
 * - Defence in depth (ADR-04): admin is checked 3 times — the route (requireRole), here (assertAdmin),
 *   and inside the database function.
 * - Audit log: the database writes a moderation-log row in the SAME transaction as the decision, so a decision
 *   can never happen without being recorded.
 * - Keyset pagination: limit + 1 trick and a cursor of (date, id), like the public feed.
 */
import type { AdminCard, ExperienceStatus, ModerationResult, Page } from "@preplens/shared";
import type { AdminQueueReader, ModerationWriter } from "../domain/ports.js";
import type { ModerationCommand } from "../domain/ModerationCommand.js";
import { ForbiddenError } from "../domain/errors.js";
import { isAdmin, type Viewer } from "../domain/viewer.js";
import { decodeCursor, encodeCursor } from "../lib/cursor.js";

export class ModerationService {
  constructor(private readonly writer: ModerationWriter, private readonly queue: AdminQueueReader, private readonly viewer: Viewer) {}

  /** Runs the command (polymorphism: the same call works for approve, reject, remove and reinstate). */
  async execute(cmd: ModerationCommand): Promise<ModerationResult> {
    this.assertAdmin();
    return { status: await cmd.run(this.writer) };
  }

  /** The review queue for one status, newest first, paged with a cursor. */
  async list(q: { status: ExperienceStatus; cursor?: string; limit: number }): Promise<Page<AdminCard>> {
    this.assertAdmin();
    const after = q.cursor ? decodeCursor(q.cursor) : undefined;
    const rows = await this.queue.list({ status: q.status, ...(after ? { after: { at: after.createdAt, id: after.id } } : {}), limit: q.limit + 1 });
    const hasMore = rows.length > q.limit; // the extra row tells us if there is a next page
    const data = hasMore ? rows.slice(0, q.limit) : rows;
    const last = data.at(-1);
    return { data, page: { hasMore, nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null } };
  }

  /** Second layer of the admin check. */
  private assertAdmin() {
    if (!isAdmin(this.viewer)) throw new ForbiddenError("Admins only.");
  }
}
