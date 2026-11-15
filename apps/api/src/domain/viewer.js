export const isSignedIn = (v) => v.kind === "user";
export const isAdmin = (v) => v.kind === "user" && v.role === "admin";
