/**
 * domain/Submission.ts — TURNS A SUBMITTED FORM INTO A CLEAN POST
 *
 * What it does: a student can post in two ways:
 *   - Quick: one free-text box.
 *   - Detailed: round by round, with questions and tips.
 * Both are turned into the SAME shape (a list of rounds), so the database and readers only ever see rounds.
 *
 * System design:
 * - Template Method pattern: toPayload() is the fixed recipe (check -> build rounds -> make sure there is at least
 *   one round -> build the payload). Only the "build rounds" step differs, and each child class fills it in.
 * - OOP: abstraction (abstract class Submission), inheritance (QuickSubmission, DetailedSubmission extend it),
 *   polymorphism (callers just call toPayload(), whichever kind it is).
 * - Liskov Substitution: every child returns at least one valid round, so callers can treat them the same.
 * - Factory pattern: SubmissionFactory.create() picks the right class from the form's "mode".
 * - Open/Closed: a third way of posting would be a new class; the service doesn't change.
 */
import type { SubmissionDto } from "@preplens/shared";
import { ValidationError } from "./errors.js";
import type { RoundPayload, SubmitPayload } from "./ports.js";

type Quick = Extract<SubmissionDto, { mode: "quick" }>;
type Detailed = Extract<SubmissionDto, { mode: "detailed" }>;

export abstract class Submission<T extends SubmissionDto = SubmissionDto> {
  constructor(protected readonly dto: T) {}

  /** The fixed recipe (Template Method). Children never override this; they only supply the steps below. */
  toPayload(): SubmitPayload {
    this.validateSpecific();               // step 1: any extra checks for this kind
    const rounds = this.normaliseRounds(); // step 2: build the rounds (different per kind)
    if (rounds.length < 1) throw new ValidationError("Add at least one round.", { rounds: "required" });
    const { dto } = this;
    // step 3: the common fields, the same for every kind of post
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

  /** Each child MUST say how it builds rounds. */
  protected abstract normaliseRounds(): RoundPayload[];
  /** Optional extra checks; does nothing unless a child overrides it. */
  protected validateSpecific(): void {}
}

/** Quick post: the one text box becomes a single round called "Overview", so every post has the same structure. */
export class QuickSubmission extends Submission<Quick> {
  protected normaliseRounds(): RoundPayload[] {
    return [{ name: "Overview", tips: this.dto.freeText, questions: [] }];
  }
}

/** Detailed post: round by round. Extra check: at most 120 questions in total. */
export class DetailedSubmission extends Submission<Detailed> {
  protected validateSpecific(): void {
    const total = this.dto.rounds.reduce((n, r) => n + r.questions.length, 0);
    if (total > 120) throw new ValidationError("That is too many questions in one experience.", { rounds: "too many questions" });
  }
  protected normaliseRounds(): RoundPayload[] {
    // Keep only the allowed fields; leave out empty tips and topics.
    return this.dto.rounds.map((r) => ({
      name: r.name,
      ...(r.tips ? { tips: r.tips } : {}),
      questions: r.questions.map((q) => ({ text: q.text, ...(q.topic ? { topic: q.topic } : {}) })),
    }));
  }
}

/** Factory: "give me the right Submission for this form". Callers never name the class themselves. */
export const SubmissionFactory = {
  create(dto: SubmissionDto): Submission {
    return dto.mode === "quick" ? new QuickSubmission(dto) : new DetailedSubmission(dto);
  },
};
