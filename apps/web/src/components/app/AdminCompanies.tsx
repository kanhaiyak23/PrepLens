"use client";

import { useEffect, useState } from "react";
import type { CompanySummary, PendingCompany } from "@preplens/shared";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import { shortDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { AdminEmpty, AdminRow, AdminSection } from "./AdminRow";

/** A student-suggested company starts pending. Approve it, or merge a typo into the real company. Every decision is logged. */
export function AdminCompanies() {
  const { token } = useAuth();
  const [pending, setPending] = useState<PendingCompany[] | null>(null);
  const [active, setActive] = useState<CompanySummary[]>([]);
  const [target, setTarget] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    let live = true;
    Promise.all([api<PendingCompany[]>("/api/v1/admin/companies/pending", { token }), api<CompanySummary[]>("/api/v1/companies?limit=50")])
      .then(([p, a]) => { if (live) { setPending(p); setActive(a); } })
      .catch((e: ApiError) => { if (live) { setPending([]); setMsg({ ok: false, text: e.message }); } });
    return () => { live = false; };
  }, [token, reload]);

  async function decide(slug: string, action: "approve" | "merge") {
    if (!token) return;
    setBusy(true); setMsg(null);
    try {
      await api(`/api/v1/admin/companies/${slug}/${action}`, { token, method: "POST", body: action === "merge" ? { mergeInto: target[slug] } : {} });
      setMsg({ ok: true, text: action === "approve" ? "Company approved." : "Merged. Its posts now belong to the chosen company." });
      setReload((n) => n + 1);
    } catch (e) { setMsg({ ok: false, text: (e as ApiError).message }); } finally { setBusy(false); }
  }

  if (pending === null) return <p className="text-on-surface-variant">Loading…</p>;
  return (
    <AdminSection title="Companies waiting for approval" hint="A student typed a company we do not have yet. Approve it as new, or merge a typo into the real company (for example Amazon Web Services Inc into Amazon).">
      {msg && <Notice kind={msg.ok ? "success" : "error"}>{msg.text}</Notice>}
      {pending.length === 0 ? <AdminEmpty>No companies are waiting. Every suggestion has been handled.</AdminEmpty> : (
        <ul className="p-0 m-0 grid gap-4">
          {pending.map((x) => (
            <AdminRow key={x.slug} title={x.name} meta={[`${x.postCount} ${x.postCount === 1 ? "post" : "posts"}`, `Suggested ${shortDate(x.createdAt)}`]}
              actions={<Button size="sm" disabled={busy} onClick={() => decide(x.slug, "approve")}>Approve as new</Button>}>
              <div className="flex flex-wrap items-end gap-3 bg-surface-container-low rounded-xl p-4">
                <label className="flex-1 min-w-[12rem]"><span>Or merge into</span>
                  <select value={target[x.slug] ?? ""} onChange={(e) => setTarget((t) => ({ ...t, [x.slug]: e.target.value }))}>
                    <option value="">Choose a company…</option>{active.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
                  </select></label>
                <Button size="sm" variant="secondary" disabled={busy || !target[x.slug]} onClick={() => decide(x.slug, "merge")}>Merge</Button>
              </div>
            </AdminRow>
          ))}
        </ul>
      )}
    </AdminSection>
  );
}
