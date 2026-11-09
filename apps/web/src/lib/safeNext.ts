/** Only same-site relative paths are allowed as a post-login destination (no open redirect). */
export function safeNext(raw: string | null | undefined, fallback = "/welcome"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  return raw;
}
