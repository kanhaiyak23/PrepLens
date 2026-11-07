import type { ExperienceAction, ExperienceStatus } from "@preplens/shared";

/**
 * The experience lifecycle as an explicit state machine. The DATABASE enforces it (trigger `guard_experience`); this class is the
 * API's single description of it, used to tell a viewer what they may do next. A test compares TRANSITIONS to the SQL, so the
 * two cannot drift unnoticed.
 */
export const TRANSITIONS: readonly (readonly [ExperienceStatus, ExperienceStatus])[] = [
  ["pending", "published"], ["pending", "rejected"], ["pending", "unpublished"],
  ["rejected", "pending"], ["published", "unpublished"], ["unpublished", "pending"],
  ["published", "removed"], ["removed", "pending"],
];

export type ActionContext = { status: ExperienceStatus; isOwner: boolean; isAdmin: boolean; hasPendingUpdate: boolean };

export class ExperienceLifecycle {
  static canMove(from: ExperienceStatus, to: ExperienceStatus): boolean {
    return from === to || TRANSITIONS.some(([f, t]) => f === from && t === to);
  }

  /** What this viewer may do to a post in this state. Withdrawing is the author's instant right; moderation is the admin's. */
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
