/** The author's edit and result update. Whether it applies or queues is decided by the database (a live post is never changed in place). */
export class UpdateService {
    writer;
    constructor(writer) {
        this.writer = writer;
    }
    async update(id, dto) {
        const changes = { ...dto };
        if (dto.rounds) {
            changes.rounds = dto.rounds.map((r) => ({
                name: r.name,
                ...(r.tips ? { tips: r.tips } : {}),
                questions: r.questions.map((q) => ({ text: q.text, ...(q.topic ? { topic: q.topic } : {}) })),
            }));
        }
        return { result: await this.writer.update(id, changes) };
    }
    cancel(id) { return this.writer.cancelUpdate(id); }
}
