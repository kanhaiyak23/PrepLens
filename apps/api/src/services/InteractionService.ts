import type { BookmarkResult, InteractionState, VoteResult } from "@preplens/shared";
import type { InteractionWriter } from "../domain/ports.js";

/** Idempotent by design (ADR-07): repeating a call leaves the same state. */
export class InteractionService {
  constructor(private readonly writer: InteractionWriter) {}
  vote(id: string, on: boolean): Promise<VoteResult> { return this.writer.setVote(id, on); }
  bookmark(id: string, on: boolean): Promise<BookmarkResult> { return this.writer.setBookmark(id, on); }
  state(ids: string[]): Promise<InteractionState> { return this.writer.interactions(ids); }
}
