import type { ExperienceUpdateDto, UpdateResult } from "@preplens/shared";
import type { ExperienceWriter } from "../domain/ports.js";

/** The author's edit and result update. Whether it applies or queues is decided by the database (a live post is never changed in place). */
export class UpdateService {
  constructor(private readonly writer: ExperienceWriter) {}

  async update(id: string, dto: ExperienceUpdateDto): Promise<UpdateResult> {
    const changes: Record<string, unknown> = { ...dto };
    if (dto.rounds) {
      changes.rounds = dto.rounds.map((r) => ({
        name: r.name,
        ...(r.tips ? { tips: r.tips } : {}),
        questions: r.questions.map((q) => ({ text: q.text, ...(q.topic ? { topic: q.topic } : {}) })),
      }));
    }
    return { result: await this.writer.update(id, changes) };
  }

  cancel(id: string): Promise<void> { return this.writer.cancelUpdate(id); }
}
