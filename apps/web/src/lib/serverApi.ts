import "server-only";

const BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ServerApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Server-side read of the public API. No token: server pages only ever show what a visitor may see (ADR-09). */
export async function serverFetch<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  } catch {
    throw new ServerApiError(0, "The archive is not reachable right now.");
  }
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new ServerApiError(res.status, j?.error?.message ?? "Something went wrong.");
  }
  return (await res.json()) as T;
}
