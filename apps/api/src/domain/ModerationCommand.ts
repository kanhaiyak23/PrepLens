import type { ExperienceStatus, ModerationAction } from "@preplens/shared";
import { ValidationError } from "./errors.js";
import type { ModerationWriter } from "./ports.js";

/**
 * Command pattern: each admin decision is an object that knows its own action and runs itself.
 * Open/Closed: a new decision is a new class, and ModerationService does not change.
 * The audit row is written by the database inside the same transaction as the decision.
 */
export interface ModerationCommand {
  readonly action: ModerationAction;
  readonly experienceId: string;
  run(writer: ModerationWriter): Promise<ExperienceStatus>;
}

abstract class Base implements ModerationCommand {
  abstract readonly action: ModerationAction;
  constructor(readonly experienceId: string, protected readonly note?: string) {}
  run(writer: ModerationWriter) {
    return writer.moderate(this.experienceId, this.action, this.note);
  }
}

export class ApproveCommand extends Base { readonly action = "approve" as const; }
export class RemoveCommand extends Base { readonly action = "remove" as const; }
export class ReinstateCommand extends Base { readonly action = "reinstate" as const; }
export class RejectCommand extends Base {
  readonly action = "reject" as const;
  constructor(id: string, note?: string) {
    // The author is shown this reason, so it is required (fail fast, before touching the database).
    if (!note || !note.trim()) throw new ValidationError("A note is required when rejecting.", { note: "required" });
    super(id, note.trim());
  }
}

/** Lookup table instead of a switch (Open/Closed): a new decision is one class and one entry here. */
const COMMANDS: Record<ModerationAction, new (id: string, note?: string) => ModerationCommand> = {
  approve: ApproveCommand, reject: RejectCommand, remove: RemoveCommand, reinstate: ReinstateCommand,
};

/** Factory: callers name the action, never the class. */
export const ModerationCommandFactory = {
  create(action: ModerationAction, id: string, note?: string): ModerationCommand {
    const Command = COMMANDS[action];
    if (!Command) throw new ValidationError("Unknown moderation action.", { action: "invalid" });
    return new Command(id, note);
  },
};
