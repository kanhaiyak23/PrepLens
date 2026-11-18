/**
 * domain/ModerationCommand.ts — EACH ADMIN DECISION IS AN OBJECT
 *
 * What it does: one class per admin decision on a post:
 *   ApproveCommand (pending -> published), RejectCommand (pending -> rejected, reason required),
 *   RemoveCommand (published -> removed), ReinstateCommand (removed -> back to review).
 * ModerationCommandFactory turns the word in the URL ("approve") into the right object.
 *
 * System design:
 * - Command pattern: a request is wrapped in an object that knows how to run itself (run()).
 *   The service just calls cmd.run() without knowing which decision it is (polymorphism).
 * - Inheritance: the shared code lives once in the Base class; each command only adds its action name.
 * - Encapsulation + fail fast: RejectCommand refuses to even be created without a reason,
 *   because the author is shown that reason.
 * - Factory pattern with a lookup table instead of a switch (Open/Closed principle):
 *   a new decision = one new class + one line in COMMANDS. ModerationService doesn't change.
 * - Atomic audit: the database writes the moderation-log row in the same transaction as the decision.
 */
import type { ExperienceStatus, ModerationAction } from "@preplens/shared";
import { ValidationError } from "./errors.js";
import type { ModerationWriter } from "./ports.js";

/** What every command promises: its action name, which post, and a run() method. */
export interface ModerationCommand {
  readonly action: ModerationAction;
  readonly experienceId: string;
  run(writer: ModerationWriter): Promise<ExperienceStatus>;
}

/** Shared code for all commands (written once): run() asks the writer to apply this action to this post. */
abstract class Base implements ModerationCommand {
  abstract readonly action: ModerationAction;
  constructor(readonly experienceId: string, protected readonly note?: string) {}
  run(writer: ModerationWriter) {
    return writer.moderate(this.experienceId, this.action, this.note);
  }
}

export class ApproveCommand extends Base { readonly action = "approve" as const; }     // pending -> published
export class RemoveCommand extends Base { readonly action = "remove" as const; }       // published -> removed
export class ReinstateCommand extends Base { readonly action = "reinstate" as const; } // removed -> pending (reviewed again)
export class RejectCommand extends Base {                                              // pending -> rejected
  readonly action = "reject" as const;
  constructor(id: string, note?: string) {
    // The author sees this reason, so it is required. Checked here, before touching the database (fail fast).
    if (!note || !note.trim()) throw new ValidationError("A note is required when rejecting.", { note: "required" });
    super(id, note.trim());
  }
}

/** Lookup table: action word -> command class. Adding a decision = add one entry here. */
const COMMANDS: Record<ModerationAction, new (id: string, note?: string) => ModerationCommand> = {
  approve: ApproveCommand, reject: RejectCommand, remove: RemoveCommand, reinstate: ReinstateCommand,
};

/** Factory: callers say the action ("approve"), never the class name. Unknown action -> 400. */
export const ModerationCommandFactory = {
  create(action: ModerationAction, id: string, note?: string): ModerationCommand {
    const Command = COMMANDS[action];
    if (!Command) throw new ValidationError("Unknown moderation action.", { action: "invalid" });
    return new Command(id, note);
  },
};
