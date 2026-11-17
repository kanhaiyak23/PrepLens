import type { ReportDto, ReportResult } from "@preplens/shared";
import type { ReportWriter } from "../domain/ports.js";

export class ReportService {
  constructor(private readonly writer: ReportWriter) {}
  async report(id: string, dto: ReportDto): Promise<ReportResult> {
    return { id: await this.writer.report(id, dto.reason, dto.note) };
  }
}
