/**
 * lib/cursor.ts — THE "BOOKMARK" FOR PAGING THROUGH LISTS
 *
 * What it does: when a list (like the admin queue) is shown 20 at a time, the API gives back a "cursor":
 * a short string that means "continue after this item". These two functions turn
 * {date of last item, id of last item} into that string and back.
 *
 * System design:
 * - Keyset (cursor) pagination, not page numbers (ADR-08): "give me items after X" stays fast no matter how long
 *   the list is, and no item is skipped or shown twice when new items arrive while you scroll.
 *   The id is the tiebreaker when two items have the same date.
 * - Opaque token: the client must not build or edit cursors; they are base64-encoded.
 * - Never trust input: a cursor coming back from the browser is checked (shape, date, id format) before use.
 */
import { ValidationError } from "../domain/errors.js";

export type Cursor = { createdAt: string; id: string };

/** {date, id} -> short base64 string the client sends back to get the next page. */
export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify({ c: c.createdAt, i: c.id }), "utf8").toString("base64url");
}

/** Short string -> {date, id}. Anything tampered with or malformed becomes a 400 "cursor is not valid". */
export function decodeCursor(raw: string): Cursor {
  try {
    const o = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { c?: unknown; i?: unknown };
    if (typeof o.c !== "string" || typeof o.i !== "string") throw new Error("shape");
    if (Number.isNaN(Date.parse(o.c))) throw new Error("date");
    if (!/^[0-9a-f-]{36}$/i.test(o.i)) throw new Error("id");
    return { createdAt: o.c, id: o.i };
  } catch {
    throw new ValidationError("The cursor is not valid.", { cursor: "invalid" });
  }
}
