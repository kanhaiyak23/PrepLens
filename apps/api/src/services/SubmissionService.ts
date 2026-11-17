import type { SubmissionDto, SubmitResult } from "@preplens/shared";
import type { ExperienceWriter } from "../domain/ports.js";
import { SubmissionFactory } from "../domain/Submission.js";

export class SubmissionService {
  constructor(private readonly writer: ExperienceWriter) {}

  /** Single responsibility: choose the form, normalise it, hand it to storage. Rules live in the database function. */
  async submit(dto: SubmissionDto): Promise<SubmitResult> {
    const payload = SubmissionFactory.create(dto).toPayload();
    const id = await this.writer.submit(payload);
    return { id, status: "pending" };
  }
}
