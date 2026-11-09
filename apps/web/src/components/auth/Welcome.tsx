"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BRANCHES, type MeResponse } from "@preplens/shared";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase/client";
import { DeleteAccount } from "./DeleteAccount";

type State = { kind: "loading" } | { kind: "ready"; me: MeResponse } | { kind: "error"; message: string; code?: string };

/** The first screen after sign-in. It proves the whole chain: Google, Supabase session, API token check, profile row. */
export function Welcome() {
  const router = useRouter();
  const { token, loading: authLoading } = useAuth();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [batch, setBatch] = useState("");
  const [branch, setBranch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.replace("/signin?next=/welcome");
      return;
    }
    api<MeResponse>("/api/v1/me", { token })
      .then((me) => {
        setState({ kind: "ready", me });
        setBatch(me.graduationBatch ? String(me.graduationBatch) : "");
        setBranch(me.branch ?? "");
      })
      .catch((e: ApiError) => setState({ kind: "error", message: e.message, code: e.code }));
  }, [authLoading, token, router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setFormError(null);
    setSaved(null);
    try {
      const me = await api<MeResponse>("/api/v1/me", { token, method: "PATCH", body: { graduationBatch: Number(batch), branch } });
      setState({ kind: "ready", me });
      setSaved("Profile saved.");
    } catch (err) {
      const e2 = err as ApiError;
      setFormError(
        e2.code === "UPSTREAM_UNAVAILABLE" && e2.status === 503
          ? "The API could not check the rate limit. Add SUPABASE_SERVICE_ROLE_KEY to apps/api/.env and restart the API."
          : e2.message,
      );
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/");
  }

  return (
    <div className="auth-card welcome">
      <Link className="brand" href="/" aria-label="PrepLens home">
        PrepLens
      </Link>

      {state.kind === "loading" && <p className="lede">Checking your session…</p>}

      {state.kind === "error" && (
        <>
          <h1 className="display">We could not load your account.</h1>
          <p role="alert" className="auth-error">
            {state.message}
          </p>
          <button className="btn btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </>
      )}

      {state.kind === "ready" && (
        <>
          <h1 className="display">Welcome, {state.me.fullName.split(" ")[0]}.</h1>
          <div className="welcome-grid">
          <div className="welcome-left">
          <dl className="auth-facts">
            <div>
              <dt className="mono">Signed in as</dt>
              <dd>{state.me.email}</dd>
            </div>
            <div>
              <dt className="mono">Role</dt>
              <dd>
                <span className={`chip ${state.me.role === "admin" ? "good" : "blue"}`}>{state.me.role}</span>
              </dd>
            </div>
            <div>
              <dt className="mono">Profile</dt>
              <dd>{state.me.profileComplete ? "Complete" : "Needs your batch and branch before you can post"}</dd>
            </div>
          </dl>
          <div className="auth-actions">
            <Link className="btn btn-primary" href="/submit">
              Share your interview
            </Link>
            <Link className="btn btn-ghost" href="/me">
              My posts
            </Link>
            {state.me.role === "admin" && (
              <Link className="btn btn-ghost" href="/admin">
                Admin
              </Link>
            )}
            <Link className="btn btn-ghost" href="/">
              Back to the archive
            </Link>
            <button className="btn btn-ghost" onClick={signOut}>
              Sign out
            </button>
          </div>
          </div>
          <div className="welcome-right">
          <form onSubmit={save} className="auth-form">
            <label>
              <span className="mono">Graduation batch</span>
              <input id="batch" type="number" min={2000} max={2100} required value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="2027" />
            </label>
            <label>
              <span className="mono">Branch</span>
              <select id="branch" required value={branch} onChange={(e) => setBranch(e.target.value)}>
                <option value="" disabled>
                  Choose
                </option>
                {BRANCHES.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            <button className="btn btn-primary" disabled={saving} type="submit">
              {saving ? "Saving…" : "Save profile"}
            </button>
          </form>
          {saved && <p role="status" className="auth-ok">{saved}</p>}
          {formError && <p role="alert" className="auth-error">{formError}</p>}

          </div>
          </div>
          {token && <DeleteAccount token={token} isAdmin={state.me.role === "admin"} />}
        </>
      )}
    </div>
  );
}
