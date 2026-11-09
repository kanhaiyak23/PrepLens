"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AdminReport } from "@preplens/shared";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import { shortDate } from "@/lib/format";

const REASON: Record<string, string> = { "interviewer-named": "Names an interviewer", confidential: "Confidential material", false: "Looks false", abusive: "Abusive", other: "Something else" };

/** Open reports. Dismiss one, or remove the post (which settles every open report on it). */
export function AdminReports() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AdminReport[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!token) return;
    let live = true;
    api<AdminReport[]>("/api/v1/admin/reports?status=open", { token }).then((r) => live && setRows(r)).catch((e: ApiError) => { if (live) { setRows([]); setMsg({ ok: false, text: e.message }); } });
    return () => { live = false; };
  }, [token, reload]);

  async function act(path: string, ok: string) {
    if (!token) return;
    setBusy(true); setMsg(null);
    try { await api(path, { token, method: "POST", body: {} }); setMsg({ ok: true, text: ok }); setReload((n) => n + 1); }
    catch (e) { setMsg({ ok: false, text: (e as ApiError).message }); } finally { setBusy(false); }
  }

  if (rows === null) return null;
  return (
    <section className="admin-block">
      <h2 className="mono">Open reports</h2>
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "auth-ok" : "auth-error"}>{msg.text}</p>}
      {rows.length === 0 ? <p className="muted">No open reports.</p> : (
        <ul className="mylist">
          {rows.map((r) => (
            <li key={r.id} className="myrow">
              <div>
                <h3><Link href={`/experience/${r.experienceId}`}>{r.companyName}</Link> <span className="muted">· {r.role}</span></h3>
                <p className="xcard-meta"><span className="chip bad">{REASON[r.reason] ?? r.reason}</span><span>{shortDate(r.createdAt)}</span></p>
                {r.note && <p className="rnote">&ldquo;{r.note}&rdquo;</p>}
              </div>
              <div className="myside">
                <button className="btn btn-ghost small" disabled={busy} onClick={() => act(`/api/v1/admin/reports/${r.id}/dismiss`, "Report dismissed.")}>Dismiss</button>
                {r.experienceStatus === "published" && <button className="btn btn-primary small" disabled={busy} onClick={() => act(`/api/v1/admin/experiences/${r.experienceId}/remove`, "Post removed. Its open reports are settled.")}>Remove post</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
