/**
 * Polymorphism instead of an if/else on a flag. The database already decides what to return (ADR-06); this is the API's own
 * output gate: whatever shape arrives, an anonymous author can only ever serialise to `{ anonymous, batch }`.
 */
export class AuthorVisibility {
}
export class AnonymousAuthor extends AuthorVisibility {
    batch;
    constructor(batch) {
        super();
        this.batch = batch;
    }
    toPublic() { return { anonymous: true, batch: this.batch }; }
}
/** A named author: the student who chose to be identified, or a student an admin posted for with their consent. */
export class NamedAuthor extends AuthorVisibility {
    name;
    batch;
    branch;
    constructor(name, batch, branch) {
        super();
        this.name = name;
        this.batch = batch;
        this.branch = branch;
    }
    toPublic() { return { anonymous: false, name: this.name, batch: this.batch, branch: this.branch }; }
}
export const AuthorVisibilityFactory = {
    /** Fails closed: anything not explicitly `anonymous: false` is treated as anonymous. */
    fromDb(raw) {
        const o = (raw ?? {});
        if (o.anonymous !== false)
            return new AnonymousAuthor(o.batch ?? null);
        return new NamedAuthor(o.name ?? null, o.batch ?? null, o.branch ?? null);
    },
};
