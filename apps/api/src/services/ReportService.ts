/**
 * services/ReportService.ts — REPORT A POST
 *
 * What it does: a signed-in student flags a post with a reason (from a fixed list) and an optional note.
 * It lands in the admins' "Reports" queue.
 *
 * System design:
 * - Community moderation: users help find problems; admins decide.
 * - The reason is an enum (fixed list), checked by validation and by a database constraint.
 * - Abuse protection: limited to 10 reports a day per user (see the route).
 */
import type { ReportDto, ReportResult } from "@preplens/shared";
import type { ReportWriter } from "../domain/ports.js";

export class ReportService {
  constructor(private readonly writer: ReportWriter) {}
  async report(id: string, dto: ReportDto): Promise<ReportResult> {
    return { id: await this.writer.report(id, dto.reason, dto.note) };
  }
}
