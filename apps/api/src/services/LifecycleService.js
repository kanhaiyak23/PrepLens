/** The author's own controls: withdraw is instant and unconditional; coming back goes through review again. */
export class LifecycleService {
    writer;
    constructor(writer) {
        this.writer = writer;
    }
    async unpublish(id) { return { status: await this.writer.setVisibility(id, false) }; }
    async republish(id) { return { status: await this.writer.setVisibility(id, true) }; }
}
