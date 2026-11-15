import { AuthenticationError, ForbiddenError } from "../domain/errors.js";
function bearer(req) {
    const h = req.header("authorization");
    if (!h)
        return null;
    const m = /^Bearer\s+(\S+)$/i.exec(h);
    if (!m)
        throw new AuthenticationError("The Authorization header must be: Bearer <token>.");
    return m[1] ?? null;
}
/**
 * Resolves who is calling (ADR-22). Identity comes from the verified token; the role comes from the database
 * on every request. Nothing about identity is ever read from the body, query or custom headers.
 *
 * - optional: no token means a visitor. A token that is present but invalid is an error, never a silent downgrade.
 * - required: no token means 401.
 */
export function authenticate(c, mode) {
    return async (req, res, next) => {
        try {
            const token = bearer(req);
            let viewer = { kind: "visitor" };
            if (token) {
                const { userId, email } = await c.verifier.verify(token);
                // Provisional viewer so we can read our own profile as ourselves (RLS), then fix the role.
                const provisional = { kind: "user", id: userId, email, role: "student", token };
                const me = await c.servicesFor(provisional).me.getMe();
                viewer = { ...provisional, role: me.role };
            }
            else if (mode === "required") {
                throw new AuthenticationError("Sign in to continue.");
            }
            req.ctx = { requestId: String(res.locals.requestId), viewer, services: c.servicesFor(viewer) };
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
export function requireRole(role) {
    return (req, _res, next) => {
        const v = req.ctx.viewer;
        if (v.kind !== "user")
            return next(new AuthenticationError("Sign in to continue."));
        if (role === "admin" && v.role !== "admin")
            return next(new ForbiddenError("Admins only."));
        next();
    };
}
