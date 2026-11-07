import type { Branch, PublicAuthor } from "@preplens/shared";

/**
 * Polymorphism instead of an if/else on a flag. The database already decides what to return (ADR-06); this is the API's own
 * output gate: whatever shape arrives, an anonymous author can only ever serialise to `{ anonymous, batch }`.
 */
export abstract class AuthorVisibility {
  abstract toPublic(): PublicAuthor;
}

export class AnonymousAuthor extends AuthorVisibility {
  constructor(private readonly batch: number | null) { super(); }
  toPublic(): PublicAuthor { return { anonymous: true, batch: this.batch }; }
}

/** A named author: the student who chose to be identified, or a student an admin posted for with their consent. */
export class NamedAuthor extends AuthorVisibility {
  constructor(private readonly name: string | null, private readonly batch: number | null, private readonly branch: Branch | null) { super(); }
  toPublic(): PublicAuthor { return { anonymous: false, name: this.name, batch: this.batch, branch: this.branch }; }
}

export const AuthorVisibilityFactory = {
  /** Fails closed: anything not explicitly `anonymous: false` is treated as anonymous. */
  fromDb(raw: unknown): AuthorVisibility {
    const o = (raw ?? {}) as Record<string, unknown>;
    if (o.anonymous !== false) return new AnonymousAuthor((o.batch as number) ?? null);
    return new NamedAuthor((o.name as string) ?? null, (o.batch as number) ?? null, (o.branch as Branch) ?? null);
  },
};
