"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DeletionResult } from "@preplens/shared";
import { api, ApiError } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase/client";

/** Self-service deletion with an explicit choice about live posts. Admin accounts cannot delete themselves (the audit log must keep resolving to a person). */
export function DeleteAccount({ token, isAdmin }: { token: string; isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [posts, setPosts] = useState<"keep" | "delete">("keep");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAdmin) return <p className="muted danger-note">Admin accounts cannot delete themselves. Ask another admin to remove your admin role first.</p>;

  async function run() {
    setBusy(true); setError(null);
    try {
      await api<DeletionResult>(`/api/v1/me?posts=${posts}`, { token, method: "DELETE" });
      await supabaseBrowser().auth.signOut();
      router.replace("/");
    } catch (e) { setError((e as ApiError).message); setBusy(false); }
  }

  if (!open) return <button className="btn btn-ghost danger" onClick={() => setOpen(true)}>Delete my account</button>;

  return (
    <fieldset className="danger-box">
      <legend className="mono">Delete my account</legend>
      <p>This cannot be undone. Posts that are not public yet are always deleted. What should happen to your public posts?</p>
      <label className="check"><input type="radio" name="posts" checked={posts === "keep"} onChange={() => setPosts("keep")} /><span><b>Keep them, anonymously.</b> They stay for juniors, with no name, branch or link to you.</span></label>
      <label className="check"><input type="radio" name="posts" checked={posts === "delete"} onChange={() => setPosts("delete")} /><span><b>Delete everything.</b> All your posts disappear with the account.</span></label>
      <label><span className="mono">Type DELETE to confirm</span><input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></label>
      {error && <p role="alert" className="auth-error">{error}</p>}
      <div className="auth-actions">
        <button className="btn btn-primary danger-fill" disabled={busy || confirm !== "DELETE"} onClick={run}>{busy ? "Deleting…" : "Delete my account"}</button>
        <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </fieldset>
  );
}
