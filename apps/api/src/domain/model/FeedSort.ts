import type { ExperienceCard, FeedSortName } from "@preplens/shared";
import { ValidationError } from "../errors.js";

/** Where to resume after the last row of the previous page. One variant per sort order. */
export type FeedAfter =
  | { kind: "newest"; createdAt: string; id: string }
  | { kind: "interview"; year: number; month: number; id: string };

/**
 * Strategy (and Template Method for the shared cursor handling): each ordering knows its own sort key and how to resume from it.
 * Open/Closed: a new ordering is a new subclass and one SQL branch; the service and routes do not change.
 * The cursor carries the sort name, so a cursor from one ordering is rejected under another (a 400, never a silent restart).
 */
export abstract class FeedSort {
  abstract readonly name: FeedSortName;
  protected abstract keyOf(card: ExperienceCard): string;
  protected abstract resume(key: string, id: string): FeedAfter;

  nextCursor(last: ExperienceCard): string {
    return Buffer.from(JSON.stringify({ s: this.name, k: this.keyOf(last), i: last.id }), "utf8").toString("base64url");
  }

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

export class NewestFirst extends FeedSort {
  readonly name = "newest" as const;
  protected keyOf(card: ExperienceCard) { return card.createdAt; }
  protected resume(key: string, id: string): FeedAfter {
    if (Number.isNaN(Date.parse(key))) throw new Error("date");
    return { kind: "newest", createdAt: key, id };
  }
}

/** Newest interview first. A post with no month sorts after the dated posts of its year (month treated as 0). */
export class InterviewDateFirst extends FeedSort {
  readonly name = "interview" as const;
  protected keyOf(card: ExperienceCard) { return `${card.interviewYear}.${card.interviewMonth ?? 0}`; }
  protected resume(key: string, id: string): FeedAfter {
    const m = /^(\d{4})\.(\d{1,2})$/.exec(key);
    if (!m) throw new Error("key");
    return { kind: "interview", year: Number(m[1]), month: Number(m[2]), id };
  }
}

export const FeedSorts = {
  create(name: FeedSortName): FeedSort {
    return name === "interview" ? new InterviewDateFirst() : new NewestFirst();
  },
};
