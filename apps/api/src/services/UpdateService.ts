/**
 * services/UpdateService.ts — EDIT MY POST, OR CANCEL MY EDIT
 *
 * What it does:
 *   - update(): sends the author's changes (including a result update like "I got selected").
 *     If the post is not live yet, the change applies now. If it IS live, the change is queued for admin review,
 *     and readers keep seeing the approved version until then.
 *   - cancel(): withdraw a queued edit.
 *
 * System design:
 * - Moderated edits: a live post is never changed in place without review (content safety).
 * - The decision "apply now or queue" is made by the database, where the post's real status is known for sure.
 * - Data cleaning: rounds and questions are rebuilt with only the allowed fields, dropping empty optional ones.
 */
import type { ExperienceUpdateDto, UpdateResult } from "@preplens/shared";
import type { ExperienceWriter } from "../domain/ports.js";

export class UpdateService {
  constructor(private readonly writer: ExperienceWriter) {}

  async update(id: string, dto: ExperienceUpdateDto): Promise<UpdateResult> {
    const changes: Record<string, unknown> = { ...dto };
    if (dto.rounds) {
      // Keep only name, tips (if any) and questions (text + topic if any).
      changes.rounds = dto.rounds.map((r) => ({
        name: r.name,
        ...(r.tips ? { tips: r.tips } : {}),
        questions: r.questions.map((q) => ({ text: q.text, ...(q.topic ? { topic: q.topic } : {}) })),
      }));
    }
    return { result: await this.writer.update(id, changes) }; // "applied" or "queued"
  }

  cancel(id: string): Promise<void> { return this.writer.cancelUpdate(id); }
}
