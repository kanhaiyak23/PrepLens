import { SubmissionFactory } from "../domain/Submission.js";
export class SubmissionService {
    writer;
    constructor(writer) {
        this.writer = writer;
    }
    /** Single responsibility: choose the form, normalise it, hand it to storage. Rules live in the database function. */
    async submit(dto) {
        const payload = SubmissionFactory.create(dto).toPayload();
        const id = await this.writer.submit(payload);
        return { id, status: "pending" };
    }
}
