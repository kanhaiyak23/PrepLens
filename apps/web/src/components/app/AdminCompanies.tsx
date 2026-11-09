"use client";

import { useEffect, useState } from "react";
import type { CompanySummary, PendingCompany } from "@preplens/shared";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import { shortDate } from "@/lib/format";

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

  if (pending === null) return null;
  return (
    <section className="admin-block">
      <h2 className="mono">Companies waiting for approval</h2>
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "auth-ok" : "auth-error"}>{msg.text}</p>}
      {pending.length === 0 ? <p className="muted">None. Every suggested company has been handled.</p> : (
        <ul className="mylist">
          {pending.map((c) => (
            <li key={c.slug} className="myrow">
              <div><h3>{c.name}</h3><p className="xcard-meta"><span>{c.postCount} {c.postCount === 1 ? "post" : "posts"}</span><span>suggested {shortDate(c.createdAt)}</span></p></div>
              <div className="myside company-actions">
                <button className="btn btn-primary small" disabled={busy} onClick={() => decide(c.slug, "approve")}>Approve as new</button>
                <label className="merge"><span className="mono">Or merge into</span>
                  <select value={target[c.slug] ?? ""} onChange={(e) => setTarget((t) => ({ ...t, [c.slug]: e.target.value }))}>
                    <option value="">Choose…</option>{active.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
                  </select></label>
                <button className="btn btn-ghost small" disabled={busy || !target[c.slug]} onClick={() => decide(c.slug, "merge")}>Merge</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
