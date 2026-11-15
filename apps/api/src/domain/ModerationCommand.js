import { ValidationError } from "./errors.js";
class Base {
    experienceId;
    note;
    constructor(experienceId, note) {
        this.experienceId = experienceId;
        this.note = note;
    }
    run(writer) {
        return writer.moderate(this.experienceId, this.action, this.note);
    }
}
export class ApproveCommand extends Base {
    action = "approve";
}
export class RemoveCommand extends Base {
    action = "remove";
}
export class ReinstateCommand extends Base {
    action = "reinstate";
}
export class RejectCommand extends Base {
    action = "reject";
    constructor(id, note) {
        // The author is shown this reason, so it is required (fail fast, before touching the database).
        if (!note || !note.trim())
            throw new ValidationError("A note is required when rejecting.", { note: "required" });
        super(id, note.trim());
    }
}
export const ModerationCommandFactory = {
    create(action, id, note) {
        switch (action) {
            case "approve": return new ApproveCommand(id);
            case "reject": return new RejectCommand(id, note);
            case "remove": return new RemoveCommand(id);
            case "reinstate": return new ReinstateCommand(id);
        }
    },
};
