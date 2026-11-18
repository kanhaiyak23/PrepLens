"use client";

import { useCallback, useEffect, useState } from "react";
import type { MeResponse } from "@preplens/shared";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./useAuth";

/**
 * One shared /me request per signed-in token. The header, the page and any form on it all ask for the profile;
 * without this each one made its own API call (2–3 identical calls per page). A failed request is forgotten so the
 * next caller retries; refresh() forces a fresh read.
 */
let shared: { token: string; promise: Promise<MeResponse> } | null = null;

export function loadMe(token: string, force = false): Promise<MeResponse> {
  if (force || !shared || shared.token !== token) {
    const promise = api<MeResponse>("/api/v1/me", { token });
    shared = { token, promise };
    promise.catch(() => { if (shared?.promise === promise) shared = null; });
  }
  return shared.promise;
}

/** Keep the shared copy in step after the profile is edited, so other components see the new values. */
function remember(token: string, me: MeResponse) {
  shared = { token, promise: Promise.resolve(me) };
}

/**
 * The signed-in user's profile. One hook instead of five copies of the same fetch (DRY), and components depend on this
 * hook rather than on the URL (Dependency Inversion): if the endpoint changes, one file changes.
 * Returns me === null while loading or when signed out; check `signedIn` and `loading` to tell which.
 */
export function useMe() {
  const { token, loading: authLoading } = useAuth();
  const [fetched, setFetched] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((force: boolean) => {
    if (!token) return;
    loadMe(token, force).then((m) => { setFetched(m); setError(null); }).catch((e: ApiError) => setError(e.message));
  }, [token]);

  useEffect(() => { load(false); }, [load]);

  const refresh = useCallback(() => load(true), [load]);
  const setMe = useCallback((m: MeResponse) => { setFetched(m); if (token) remember(token, m); }, [token]);

  const me = token ? fetched : null;
  return { me, setMe, refresh, token, signedIn: !!token, loading: authLoading || (!!token && !me && !error), error };
}
