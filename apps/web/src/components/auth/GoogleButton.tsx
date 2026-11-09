"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safeNext";

/** Starts Google sign-in through Supabase Auth. The `hd` hint only narrows Google's account picker; the database enforces the domain. */
export function GoogleButton({ next = "/welcome", className = "btn btn-primary", children = "Continue with Google" }: { next?: string; className?: string; children?: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
        queryParams: { hd: "nst.rishihood.edu.in", prompt: "select_account" },
      },
    });
    if (error) {
      setErr("Could not start Google sign-in. Please try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={start} disabled={busy} aria-busy={busy}>
        {busy ? "Opening Google…" : children}
      </button>
      {err && <p role="alert" className="auth-error">{err}</p>}
    </>
  );
}
