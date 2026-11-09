"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AdminUpdate } from "@preplens/shared";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import { OUTCOME_LABEL, shortDate } from "@/lib/format";

/** What the author wants to change, in words. */
function summarise(u: AdminUpdate): string[] {
  const c = u.changes as Record<string, unknown>;
  const out: string[] = [];
  if (c.outcome) out.push(`Outcome: ${OUTCOME_LABEL[u.outcome]} → ${OUTCOME_LABEL[c.outcome as keyof typeof OUTCOME_LABEL] ?? String(c.outcome)}`);
  if (c.role) out.push(`Role: ${u.role} → ${String(c.role)}`);
  if (c.driveType) out.push(`Drive: ${String(c.driveType)}`);
  if (c.interviewYear) out.push(`Year: ${u.interviewYear} → ${String(c.interviewYear)}`);
  if (Array.isArray(c.rounds)) out.push(`Rounds rewritten (${c.rounds.length} ${c.rounds.length === 1 ? "round" : "rounds"})`);
  return out.length ? out : ["Other details"];
}

export function AdminUpdates() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AdminUpdate[] | null>(null);
  const [reject, setReject] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!token) return;
    let live = true;
    api<AdminUpdate[]>("/api/v1/admin/updates", { token }).then((r) => live && setRows(r)).catch((e: ApiError) => { if (live) { setRows([]); setMsg({ ok: false, text: e.message }); } });
    return () => { live = false; };
  }, [token, reload]);

  async function decide(id: string, action: "approve" | "reject") {
    if (!token) return;
    setBusy(true); setMsg(null);
    try {
      await api(`/api/v1/admin/experiences/${id}/update/${action}`, { token, method: "POST", body: action === "reject" ? { note } : {} });
      setMsg({ ok: true, text: action === "approve" ? "Change approved and applied." : "Change rejected." });
      setReject(null); setNote(""); setReload((n) => n + 1);
    } catch (e) { setMsg({ ok: false, text: (e as ApiError).message }); } finally { setBusy(false); }
  }

  if (rows === null) return null;
  return (
    <section className="admin-block">
      <h2 className="mono">Edits waiting for review</h2>
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "auth-ok" : "auth-error"}>{msg.text}</p>}
      {rows.length === 0 ? <p className="muted">None.</p> : (
        <ul className="mylist">
          {rows.map((u) => (
            <li key={u.id} className="myrow">
              <div>
                <h3><Link href={`/experience/${u.id}`}>{u.company.name}</Link> <span className="muted">· {u.role}</span></h3>
                <ul className="changes">{summarise(u).map((t) => <li key={t}>{t}</li>)}</ul>
                <p className="xcard-meta"><span>submitted {shortDate(u.submittedAt)}</span></p>
                {reject === u.id && (
                  <form className="reject-form" onSubmit={(e) => { e.preventDefault(); void decide(u.id, "reject"); }}>
                    <label><span className="mono">Reason shown to the author</span><input required value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} /></label>
                    <div className="xbtns"><button className="btn btn-primary small" disabled={busy}>Send rejection</button><button type="button" className="btn btn-ghost small" onClick={() => setReject(null)}>Cancel</button></div>
                  </form>
                )}
              </div>
              <div className="myside">
                <button className="btn btn-primary small" disabled={busy} onClick={() => decide(u.id, "approve")}>Approve</button>
                <button className="btn btn-ghost small" disabled={busy} onClick={() => setReject(u.id)}>Reject</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
