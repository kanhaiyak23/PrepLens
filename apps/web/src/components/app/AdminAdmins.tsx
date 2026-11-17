"use client";

import { useEffect, useState } from "react";
import type { AdminMember } from "@preplens/shared";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import { shortDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { AdminRow, AdminSection } from "./AdminRow";

/**
 * Admin roles (ADR-31). Add an admin by their college email, or remove someone's admin access.
 * Presentation only: who may do what is decided by the API and the database (never your own access, never the last admin).
 * Removing asks for a second click, because it takes effect on that person's very next request.
 */
export function AdminAdmins() {
  const { token } = useAuth();
  const [admins, setAdmins] = useState<AdminMember[] | null>(null);
  const [email, setEmail] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    let live = true;
    api<AdminMember[]>("/api/v1/admin/admins", { token })
      .then((a) => { if (live) setAdmins(a); })
      .catch((e: ApiError) => { if (live) { setAdmins([]); setMsg({ ok: false, text: e.message }); } });
    return () => { live = false; };
  }, [token, reload]);

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !email.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const added = await api<AdminMember>("/api/v1/admin/admins", { token, method: "POST", body: { email: email.trim() } });
      setMsg({ ok: true, text: `${added.fullName} (${added.email}) is now an admin.` });
      setEmail("");
      setReload((n) => n + 1);
    } catch (err) { setMsg({ ok: false, text: (err as ApiError).message }); } finally { setBusy(false); }
  }

  async function revoke(a: AdminMember) {
    if (!token) return;
    setBusy(true); setMsg(null);
    try {
      await api(`/api/v1/admin/admins/${a.id}`, { token, method: "DELETE" });
      setMsg({ ok: true, text: `${a.fullName} is no longer an admin.` });
      setConfirming(null);
      setReload((n) => n + 1);
    } catch (err) { setMsg({ ok: false, text: (err as ApiError).message }); } finally { setBusy(false); }
  }

  return (
    <AdminSection title="Admins" hint="Admins review posts, handle reports and manage companies. Every change here is written to the moderation log.">
      {msg && <Notice kind={msg.ok ? "success" : "error"}>{msg.text}</Notice>}

      <form onSubmit={grant} className="flex flex-col sm:flex-row sm:items-end gap-3 bg-surface-container-lowest border border-outline-variant/80 rounded-2xl p-4 sm:p-5">
        <label className="flex-1 min-w-0">
          <span>Make someone an admin</span>
          <input type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name.surname@nst.rishihood.edu.in" />
          <small>They must have signed in to PrepLens at least once.</small>
        </label>
        <Button type="submit" disabled={busy || !email.trim()} className="sm:mb-6">Add admin</Button>
      </form>

      {admins === null ? <p className="text-on-surface-variant">Loading…</p> : (
        <ul className="p-0 m-0 grid gap-3">
          {admins.map((a) => (
            <AdminRow key={a.id} title={a.fullName} subtitle={a.email}
              badges={a.isSelf ? <Badge tone="primary">You</Badge> : undefined}
              meta={[`Joined ${shortDate(a.joinedAt)}`]}
              actions={a.isSelf
                ? <span className="text-xs text-on-surface-variant">Another admin can remove your access.</span>
                : confirming === a.id
                  ? <>
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => revoke(a)}>Yes, remove admin</Button>
                      <Button size="sm" variant="quiet" disabled={busy} onClick={() => setConfirming(null)}>Cancel</Button>
                    </>
                  : <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirming(a.id)}>Remove admin</Button>} />
          ))}
        </ul>
      )}
    </AdminSection>
  );
}
