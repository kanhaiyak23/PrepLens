/**
 * services/InteractionService.ts — VOTES AND BOOKMARKS
 *
 * What it does: turn a vote on/off, turn a bookmark on/off, and tell the website which of a list of posts
 * the user has voted on or saved.
 *
 * System design:
 * - Idempotent operations (ADR-07): "set vote = on" twice leaves exactly one vote. Retries and double-clicks are safe.
 * - Concurrency safety lives in the database: a unique rule (user + post) makes a second vote impossible,
 *   even if two requests arrive at the same instant.
 * - Dependency Inversion: uses the InteractionWriter interface only.
 */
import type { BookmarkResult, InteractionState, VoteResult } from "@preplens/shared";
import type { InteractionWriter } from "../domain/ports.js";

export class InteractionService {
  constructor(private readonly writer: InteractionWriter) {}
  /** on = true: upvote; on = false: remove my vote. Returns the new vote count. */
  vote(id: string, on: boolean): Promise<VoteResult> { return this.writer.setVote(id, on); }
  /** on = true: save the post; on = false: unsave it. Bookmarks are private. */
  bookmark(id: string, on: boolean): Promise<BookmarkResult> { return this.writer.setBookmark(id, on); }
  /** For these post ids: which did I vote on, which did I save? */
  state(ids: string[]): Promise<InteractionState> { return this.writer.interactions(ids); }
}
