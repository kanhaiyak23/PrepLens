/** Idempotent by design (ADR-07): repeating a call leaves the same state. */
export class InteractionService {
    writer;
    constructor(writer) {
        this.writer = writer;
    }
    vote(id, on) { return this.writer.setVote(id, on); }
    bookmark(id, on) { return this.writer.setBookmark(id, on); }
    state(ids) { return this.writer.interactions(ids); }
}
