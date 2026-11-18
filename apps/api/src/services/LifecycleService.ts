/**
 * services/LifecycleService.ts — THE AUTHOR'S UNPUBLISH / REPUBLISH BUTTONS
 *
 * What it does: unpublish hides the author's post instantly, no questions asked.
 * Republish sends it back to "pending", so an admin reviews it again before it is public.
 *
 * System design:
 * - State machine: both are status changes, and the database only allows legal moves
 *   (e.g. published -> unpublished, unpublished -> pending). Illegal moves are refused.
 * - Authors stay in control of their own content (privacy), but cannot skip review.
 */
import type { VisibilityResult } from "@preplens/shared";
import type { ExperienceWriter } from "../domain/ports.js";

export class LifecycleService {
  constructor(private readonly writer: ExperienceWriter) {}
  async unpublish(id: string): Promise<VisibilityResult> { return { status: await this.writer.setVisibility(id, false) }; }
  async republish(id: string): Promise<VisibilityResult> { return { status: await this.writer.setVisibility(id, true) }; }
}
