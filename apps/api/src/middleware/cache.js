/**
 * Cacheable only when the response is identical for every caller (ADR-09).
 * Public lists never depend on the viewer. Anything viewer-dependent must use noStore.
 */
export const publicCache = (sMaxAge = 60, swr = 300) => (_req, res, next) => {
    res.setHeader("Cache-Control", `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`);
    next();
};
export const noStore = (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    next();
};
/** For responses that differ for the author and admins (a hidden post): public for visitors, private for signed-in callers. */
export const cacheUnlessSignedIn = (req, res, next) => {
    res.setHeader("Vary", "Authorization");
    res.setHeader("Cache-Control", req.header("authorization") ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=300");
    next();
};
