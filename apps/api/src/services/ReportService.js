export class ReportService {
    writer;
    constructor(writer) {
        this.writer = writer;
    }
    async report(id, dto) {
        return { id: await this.writer.report(id, dto.reason, dto.note) };
    }
}
