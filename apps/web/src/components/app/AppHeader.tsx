"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { MeResponse } from "@preplens/shared";

/** Header for the working pages (archive, experiences, submit, my posts, admin). The landing page has its own. */
export function AppHeader() {
  const { token, loading } = useAuth();
  const [fetchedRole, setRole] = useState<string | null>(null);
  const role = token ? fetchedRole : null;

  useEffect(() => {
    if (!token) return;
    api<MeResponse>("/api/v1/me", { token }).then((m) => setRole(m.role)).catch(() => setRole(null));
  }, [token]);

  return (
    <header className="nav">
      <div className="wrap nav-in">
        <Link className="brand" href="/" aria-label="PrepLens home">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="16" cy="16" r="5" fill="#f2b01e" stroke="currentColor" strokeWidth="2.5" />
            <path d="M16 3v5M29 16h-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          PrepLens
        </Link>
        <nav className="app-links" aria-label="Primary">
          <Link href="/archive">Archive</Link>
          <Link href="/submit">Share yours</Link>
          {token && <Link href="/me">My posts</Link>}
          {role === "admin" && <Link href="/admin">Admin</Link>}
        </nav>
        <div className="nav-cta app-cta">
          {!loading && (token ? <Link className="btn btn-ghost" href="/welcome">Account</Link> : <Link className="btn btn-primary" href="/signin?next=/archive">Sign in</Link>)}
        </div>
      </div>
    </header>
  );
}
