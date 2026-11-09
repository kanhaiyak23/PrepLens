"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { safeNext } from "@/lib/safeNext";
import { GoogleButton } from "./GoogleButton";

export function SignInCard() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const next = safeNext(params.get("next"));
  const error = params.get("error");

  // Already signed in: go where they were headed.
  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

  return (
    <div className="auth-card">
      <Link className="brand" href="/" aria-label="PrepLens home">
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="16" cy="16" r="5" fill="#f2b01e" stroke="currentColor" strokeWidth="2.5" />
          <path d="M16 3v5M29 16h-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        PrepLens
      </Link>
      <h1 className="display">Sign in to share your interview.</h1>
      <p className="lede">Use your NST Google account. Reading the archive never needs one.</p>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      <GoogleButton next={next} />
      <p className="mono auth-note">Only @nst.rishihood.edu.in accounts can sign in</p>
      <Link className="auth-back" href="/">
        Back to the archive
      </Link>
    </div>
  );
}
