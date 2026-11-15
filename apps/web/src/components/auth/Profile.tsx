"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BRANCHES } from "@preplens/shared";
import { useMe } from "@/hooks/useMe";
import { api, ApiError } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { MeResponse } from "@preplens/shared";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { DeleteAccount } from "./DeleteAccount";

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_, i) => THIS_YEAR - 1 + i);

/**
 * Design source: Stitch "Profile - PrepLens": identity card (initial, name, "NST Verified Student", email in mono),
 * "Academic Credentials" card (Graduation year, Branch, info strip, Save + Sign out), then "Privacy & Account Data".
 * Dropped: "Shared Experiences", "Peer Impact" and "Account Status" stat tiles (peer-impact reads are not tracked), avatar photo.
 */
export function Profile() {
  const router = useRouter();
  const { me, setMe, token, signedIn, loading, error } = useMe();
  useEffect(() => { if (!loading && !signedIn) router.replace("/signin?next=/profile"); }, [loading, signedIn, router]);

  if (error) return <Notice kind="error">{error}</Notice>;
  if (!me || !token) return <p className="text-on-surface-variant">Loading…</p>;
  return <ProfileForm me={me} token={token} onSaved={setMe} />;
}

/** Split from Profile so the form's initial values come from props, not from an effect (the form mounts only once the profile has loaded). */
function ProfileForm({ me, token, onSaved }: { me: MeResponse; token: string; onSaved: (m: MeResponse) => void }) {
  const router = useRouter();
  const [batch, setBatch] = useState(me.graduationBatch ? String(me.graduationBatch) : "");
  const [branch, setBranch] = useState(me.branch ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      onSaved(await api<MeResponse>("/api/v1/me", { token, method: "PATCH", body: { graduationBatch: Number(batch), branch } }));
      setMsg({ ok: true, text: "Profile saved." });
    } catch (err) { setMsg({ ok: false, text: (err as ApiError).message }); }
    finally { setSaving(false); }
  }
  async function signOut() { await supabaseBrowser().auth.signOut(); router.replace("/"); }

  return (
    <div className="space-y-8">
      <section className="flex flex-col sm:flex-row sm:items-center gap-4 bg-surface-container-low rounded-2xl p-5">
        <span className="w-14 h-14 rounded-[50%] bg-secondary-container text-on-secondary-container flex items-center justify-center text-xl font-bold">{me.fullName.charAt(0).toUpperCase()}</span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-lg font-bold">{me.fullName}<span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg px-2 py-0.5"><Icon name="verified" className="!text-sm" />NST verified student</span></p>
          <p className="font-mono text-sm text-on-surface-variant truncate">{me.email}</p>
        </div>
      </section>

      <form onSubmit={save} className="bg-surface-container-lowest rounded-2xl border border-surface-variant p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold">Academic details</h2>
          <p className="text-sm text-on-surface-variant">Needed before you can share an interview.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <label><span>Graduation year <b className="text-error">*</b></span>
            <select required value={batch} onChange={(e) => setBatch(e.target.value)}>
              <option value="" disabled>Choose</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <small>Used to label your posts with your batch.</small></label>
          <label><span>Branch <b className="text-error">*</b></span>
            <select required value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="" disabled>Choose</option>
              {BRANCHES.map((b) => <option key={b}>{b}</option>)}
            </select>
            <small>Shown on your post unless you post anonymously.</small></label>
        </div>
        {!me.profileComplete && <Notice title="Add these to be able to share an interview.">Anonymous posts show your batch only, never your branch.</Notice>}
        {msg && <Notice kind={msg.ok ? "success" : "error"}>{msg.text}</Notice>}
        <div className="flex items-center justify-between gap-3">
          <Button type="submit" disabled={saving}><Icon name="check" className="!text-base" />{saving ? "Saving…" : "Save profile"}</Button>
          <Button type="button" variant="secondary" onClick={signOut}><Icon name="logout" className="!text-base" />Sign out</Button>
        </div>
      </form>

      <section>
        <h2 className="text-lg font-bold">Privacy and account data</h2>
        <p className="text-sm text-on-surface-variant mb-4">Delete your account and choose what happens to your public posts.</p>
        <DeleteAccount token={token} isAdmin={me.role === "admin"} />
      </section>
    </div>
  );
}
