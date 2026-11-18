/**
 * domain/model/FeedSort.ts — HOW THE FEED IS SORTED, AND HOW TO GET THE NEXT PAGE
 *
 * What it does: two ways to sort the feed:
 *   - NewestFirst: newest posts first (by date posted).
 *   - InterviewDateFirst: most recent interviews first (by interview year and month).
 * Each one knows how to build the "continue from here" cursor for the next page, and how to read it back.
 *
 * System design:
 * - Strategy pattern: the sort order is a swappable object. The service calls sort.nextCursor() / sort.after()
 *   without any "if sort === ..." code.
 * - Template Method: the shared cursor logic (encode, decode, check) is written once in FeedSort; each child only
 *   says what its sort key is (keyOf) and how to rebuild it (resume).
 * - Open/Closed: a new sort order = one new class (plus one SQL branch). The service and routes don't change.
 * - Keyset pagination: the cursor holds the last item's sort key + id, so paging stays fast and stable.
 * - Safety: the cursor includes the sort name, so a cursor from one sort used with another sort is rejected with
 *   a clear 400 error, instead of silently starting over.
 */
import type { ExperienceCard, FeedSortName } from "@preplens/shared";
import { ValidationError } from "../errors.js";

/** "Resume after this item" — one shape per sort order. */
export type FeedAfter =
  | { kind: "newest"; createdAt: string; id: string }
  | { kind: "interview"; year: number; month: number; id: string };

export abstract class FeedSort {
  abstract readonly name: FeedSortName;
  /** The sort key of a post, as text (child decides). */
  protected abstract keyOf(card: ExperienceCard): string;
  /** Rebuild the "resume after" value from the key text (child decides). */
  protected abstract resume(key: string, id: string): FeedAfter;

  /** Build the cursor string for the page after `last`: {sort name, sort key, id} encoded as base64. */
  nextCursor(last: ExperienceCard): string {
    return Buffer.from(JSON.stringify({ s: this.name, k: this.keyOf(last), i: last.id }), "utf8").toString("base64url");
  }

  /** Read a cursor sent back by the browser. Wrong sort, tampered or malformed -> 400. */
  after(cursor: string): FeedAfter {
    try {
      const o = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { s?: unknown; k?: unknown; i?: unknown };
      if (o.s !== this.name || typeof o.k !== "string" || typeof o.i !== "string" || !/^[0-9a-f-]{36}$/i.test(o.i)) throw new Error("shape");
      return this.resume(o.k, o.i);
    } catch {
      throw new ValidationError("The cursor is not valid for this sort order.", { cursor: "invalid" });
    }
  }
}

/** Sort by when it was posted. Key = the post's creation date. */
export class NewestFirst extends FeedSort {
  readonly name = "newest" as const;
  protected keyOf(card: ExperienceCard) { return card.createdAt; }
  protected resume(key: string, id: string): FeedAfter {
    if (Number.isNaN(Date.parse(key))) throw new Error("date");
    return { kind: "newest", createdAt: key, id };
  }
}

/** Sort by interview date. Key = "year.month". A post with no month counts as month 0 (after the dated posts of that year). */
export class InterviewDateFirst extends FeedSort {
  readonly name = "interview" as const;
  protected keyOf(card: ExperienceCard) { return `${card.interviewYear}.${card.interviewMonth ?? 0}`; }
  protected resume(key: string, id: string): FeedAfter {
    const m = /^(\d{4})\.(\d{1,2})$/.exec(key);
    if (!m) throw new Error("key");
    return { kind: "interview", year: Number(m[1]), month: Number(m[2]), id };
  }
}

/** Factory: sort name -> strategy object. Anything other than "interview" means newest first. */
export const FeedSorts = {
  create(name: FeedSortName): FeedSort {
    return name === "interview" ? new InterviewDateFirst() : new NewestFirst();
  },
};
