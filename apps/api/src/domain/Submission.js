import { ValidationError } from "./errors.js";
/**
 * Template Method: the steps of turning a form into a database payload are fixed here;
 * only how rounds are produced varies by subclass. Abstraction + inheritance + polymorphism.
 * Liskov: every subclass returns at least one valid round, so callers treat them identically.
 */
export class Submission {
    dto;
    constructor(dto) {
        this.dto = dto;
    }
    toPayload() {
        this.validateSpecific();
        const rounds = this.normaliseRounds();
        if (rounds.length < 1)
            throw new ValidationError("Add at least one round.", { rounds: "required" });
        const { dto } = this;
        return {
            company: dto.company,
            role: dto.role,
            driveType: dto.driveType,
            interviewYear: dto.interviewYear,
            ...(dto.interviewMonth !== undefined ? { interviewMonth: dto.interviewMonth } : {}),
            outcome: dto.outcome,
            isAnonymous: dto.isAnonymous,
            consent: true,
            rounds,
        };
    }
    validateSpecific() { }
}
/** One free-text box. Stored as a single "Overview" round so readers see the same structure everywhere. */
export class QuickSubmission extends Submission {
    normaliseRounds() {
        return [{ name: "Overview", tips: this.dto.freeText, questions: [] }];
    }
}
/** Round by round, with questions and tips. */
export class DetailedSubmission extends Submission {
    validateSpecific() {
        const total = this.dto.rounds.reduce((n, r) => n + r.questions.length, 0);
        if (total > 120)
            throw new ValidationError("That is too many questions in one experience.", { rounds: "too many questions" });
    }
    //runtime polymorphism
    normaliseRounds() {
        return this.dto.rounds.map((r) => ({
            name: r.name,
            ...(r.tips ? { tips: r.tips } : {}),
            questions: r.questions.map((q) => ({ text: q.text, ...(q.topic ? { topic: q.topic } : {}) })),
        }));
    }
}
/** Factory: callers never say which class applies. */
//it decide which object to create
export const SubmissionFactory = {
    create(dto) {
        return dto.mode === "quick" ? new QuickSubmission(dto) : new DetailedSubmission(dto);
    },
};
