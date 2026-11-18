/**
 * domain/model/ExperienceLifecycle.ts — THE LIFE OF A POST (A STATE MACHINE)
 *
 * What it does:
 *   - TRANSITIONS: the only allowed status changes, e.g. pending -> published, published -> removed.
 *   - canMove(from, to): is this change allowed?
 *   - actionsFor(...): which buttons a viewer may see on a post right now (edit, withdraw, approve, remove...).
 *
 *        pending ──approve──> published ──unpublish──> unpublished ──republish──> pending
 *           │                    │
 *        reject               remove (admin)
 *           v                    v
 *        rejected ──edit──> pending      removed ──reinstate──> pending
 *
 *   (The author can also withdraw a pending post: pending -> unpublished.)
 *
 * System design:
 * - Finite state machine: a post can only move along these arrows. The DATABASE enforces it (trigger
 *   `guard_experience`); this class describes the same rules in TypeScript so the API can tell the website
 *   which buttons to show.
 * - Single source of truth kept honest: a test reads the SQL trigger and checks it matches TRANSITIONS,
 *   so the two can never drift apart unnoticed.
 * - Role-based actions: authors get "their own" actions (edit, withdraw, republish); admins get moderation actions.
 */
import type { ExperienceAction, ExperienceStatus } from "@preplens/shared";

/** Every allowed [from, to] status change. Anything not listed is illegal. */
export const TRANSITIONS: readonly (readonly [ExperienceStatus, ExperienceStatus])[] = [
  ["pending", "published"], ["pending", "rejected"], ["pending", "unpublished"],
  ["rejected", "pending"], ["published", "unpublished"], ["unpublished", "pending"],
  ["published", "removed"], ["removed", "pending"],
];

/** What we need to know to decide the buttons: the post's status, and who is looking. */
export type ActionContext = { status: ExperienceStatus; isOwner: boolean; isAdmin: boolean; hasPendingUpdate: boolean };

export class ExperienceLifecycle {
  /** Is moving from `from` to `to` allowed? (Staying in the same status is always fine.) */
  static canMove(from: ExperienceStatus, to: ExperienceStatus): boolean {
    return from === to || TRANSITIONS.some(([f, t]) => f === from && t === to);
  }

  /** The buttons this viewer may use. The author can always withdraw instantly; moderation belongs to admins. */
  static actionsFor(c: ActionContext): ExperienceAction[] {
    const a = new Set<ExperienceAction>();
    if (c.isOwner) {
      if (c.status !== "removed") a.add("edit");
      if (c.status === "published" || c.status === "pending") a.add("withdraw");
      if (c.status === "unpublished") a.add("republish");
      if (c.hasPendingUpdate) a.add("cancel-update");
    }
    if (c.isAdmin) {
      if (c.status === "pending") { a.add("approve"); a.add("reject"); }
      if (c.status === "published") a.add("remove");
      if (c.status === "removed") a.add("reinstate");
    }
    return [...a];
  }
}
