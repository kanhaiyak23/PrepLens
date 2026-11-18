/**
 * domain/model/AuthorVisibility.ts — WHAT A READER MAY SEE ABOUT THE AUTHOR
 *
 * What it does:
 *   - AnonymousAuthor: shows ONLY "anonymous + batch" (e.g. "Anonymous · 2027"). Never the name, never the branch.
 *   - NamedAuthor: shows name, batch and branch (the student chose to be named, or an admin posted for them with consent).
 *   - AuthorVisibilityFactory.fromDb(): picks the right one from the database row.
 *
 * System design:
 * - Polymorphism instead of "if (isAnonymous) ... else ..." scattered around the code: each class knows how to
 *   present itself (toPublic()).
 * - Privacy by design / defence in depth (ADR-06): the database already hides identity for anonymous posts;
 *   this is a second gate in the API. Even if extra fields arrived by mistake, an anonymous author can only
 *   ever output { anonymous, batch }.
 * - Fail closed: if the data is unclear, the author is treated as ANONYMOUS (the safe choice), never as named.
 */
import type { Branch, PublicAuthor } from "@preplens/shared";

export abstract class AuthorVisibility {
  abstract toPublic(): PublicAuthor;
}

export class AnonymousAuthor extends AuthorVisibility {
  constructor(private readonly batch: number | null) { super(); }
  toPublic(): PublicAuthor { return { anonymous: true, batch: this.batch }; }
}

export class NamedAuthor extends AuthorVisibility {
  constructor(private readonly name: string | null, private readonly batch: number | null, private readonly branch: Branch | null) { super(); }
  toPublic(): PublicAuthor { return { anonymous: false, name: this.name, batch: this.batch, branch: this.branch }; }
}

export const AuthorVisibilityFactory = {
  /** Only an explicit `anonymous: false` gives a named author. Anything else (missing, null, odd) -> anonymous. */
  fromDb(raw: unknown): AuthorVisibility {
    const o = (raw ?? {}) as Record<string, unknown>;
    if (o.anonymous !== false) return new AnonymousAuthor((o.batch as number) ?? null);
    return new NamedAuthor((o.name as string) ?? null, (o.batch as number) ?? null, (o.branch as Branch) ?? null);
  },
};
