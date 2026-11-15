"use client";

import { useCallback, useEffect, useState } from "react";
import type { MeResponse } from "@preplens/shared";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./useAuth";

/**
 * The signed-in user's profile. One hook instead of five copies of the same fetch (DRY), and components depend on this
 * hook rather than on the URL (Dependency Inversion): if the endpoint changes, one file changes.
 * Returns me === null while loading or when signed out; check `signedIn` and `loading` to tell which.
 */
export function useMe() {
  const { token, loading: authLoading } = useAuth();
  const [fetched, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    api<MeResponse>("/api/v1/me", { token }).then((m) => { setMe(m); setError(null); }).catch((e: ApiError) => setError(e.message));
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  const me = token ? fetched : null;
  return { me, setMe, refresh, token, signedIn: !!token, loading: authLoading || (!!token && !me && !error), error };
}
