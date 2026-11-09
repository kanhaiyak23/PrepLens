/** Thin client for the PrepLens API. Sends the Supabase access token as a bearer token (ADR-22). */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number, readonly requestId?: string, readonly fields?: Record<string, string>) {
    super(message);
  }
}

export async function api<T>(path: string, opts: { token?: string; method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? "GET",
      headers: { ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}), ...(opts.body ? { "Content-Type": "application/json" } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError("UPSTREAM_UNAVAILABLE", "Cannot reach the PrepLens API. Is it running on port 4000?", 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const e = json?.error;
    throw new ApiError(e?.code ?? "INTERNAL", e?.message ?? "Something went wrong.", res.status, json?.requestId, e?.fields);
  }
  // Paged responses carry { data, page }: return them whole so callers can read the cursor.
  return (json && "page" in json ? json : (json?.data ?? json)) as T;
}
