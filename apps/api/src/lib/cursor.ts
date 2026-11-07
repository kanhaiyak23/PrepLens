import { ValidationError } from "../domain/errors.js";

export type Cursor = { createdAt: string; id: string };

/** Keyset cursor (ADR-08): opaque to clients, tamper-checked on the way in. */
export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify({ c: c.createdAt, i: c.id }), "utf8").toString("base64url");
}

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
