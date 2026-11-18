/**
 * services/SubmissionService.ts — SUBMIT A NEW POST
 *
 * What it does: takes the submitted form, turns it into a clean post (rounds and questions), saves it,
 * and answers with its id and status "pending" (it waits for admin approval before it is public).
 *
 * System design:
 * - Factory pattern: SubmissionFactory.create() picks QuickSubmission or DetailedSubmission based on the form mode,
 *   so there is no "if quick ... else ..." here.
 * - Single Responsibility: choose the form type, normalise, hand to storage. Nothing else.
 * - The input was already checked by the shared schema (e.g. 1 to 12 rounds). Rules that protect the data, such as
 *   consent, are enforced again in the database function, which saves the post, its rounds and questions in ONE
 *   transaction (all or nothing).
 */
import type { SubmissionDto, SubmitResult } from "@preplens/shared";
import type { ExperienceWriter } from "../domain/ports.js";
import { SubmissionFactory } from "../domain/Submission.js";

export class SubmissionService {
  constructor(private readonly writer: ExperienceWriter) {}

  async submit(dto: SubmissionDto): Promise<SubmitResult> {
    const payload = SubmissionFactory.create(dto).toPayload(); // quick or detailed -> one standard shape
    const id = await this.writer.submit(payload);
    return { id, status: "pending" };
  }
}
