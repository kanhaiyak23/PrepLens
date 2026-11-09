"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EXPERIENCE_STATUSES, type AdminCard, type ExperienceStatus, type MeResponse, type ModerationAction, type Page } from "@preplens/shared";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import { OUTCOME_CLASS, OUTCOME_LABEL, STATUS_LABEL, authorLabel, shortDate } from "@/lib/format";

const ACTIONS: Record<ExperienceStatus, { action: ModerationAction; label: string }[]> = {
  pending: [{ action: "approve", label: "Approve" }, { action: "reject", label: "Reject" }],
  published: [{ action: "remove", label: "Remove" }],
  removed: [{ action: "reinstate", label: "Reinstate" }],
  rejected: [],
  unpublished: [],
};

/** Moderation queue. Every decision is checked again on the server and written to the append-only log by the database. */
export function AdminQueue() {
  const router = useRouter();
  const { token, loading } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [status, setStatus] = useState<ExperienceStatus>("pending");
  const [rows, setRows] = useState<AdminCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!token) { router.replace("/signin?next=/admin"); return; }
    api<MeResponse>("/api/v1/me", { token }).then(setMe).catch((e: ApiError) => setError(e.message));
  }, [loading, token, router]);

  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!token || me?.role !== "admin") return;
    let live = true;
    api<Page<AdminCard>>(`/api/v1/admin/experiences?status=${status}&limit=50`, { token })
      .then((r) => { if (live) setRows(r.data); })
      .catch((e: ApiError) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [token, me, status, reload]);

  async function decide(id: string, action: ModerationAction, withNote?: string) {
    if (!token) return;
    setBusy(true); setError(null); setOk(null);
    try {
      await api(`/api/v1/admin/experiences/${id}/${action}`, { token, method: "POST", body: withNote ? { note: withNote } : {} });
      setOk(`Done: ${action}.`); setRejecting(null); setNote("");
      setReload((n) => n + 1);
    } catch (e) { setError((e as ApiError).message); } finally { setBusy(false); }
  }

  if (!me) return <p className="empty">{error ?? "Checking your access…"}</p>;
  if (me.role !== "admin") return <div className="empty-state"><h2>Admins only.</h2><p>This page is for the PrepLens admin team.</p><Link className="btn btn-primary" href="/">Back home</Link></div>;

  return (
    <>
      <h2 className="mono queue-h">Posts</h2>
      <div className="pillrow" role="tablist" aria-label="Queue">
        {EXPERIENCE_STATUSES.map((s) => <button key={s} role="tab" className="pill" aria-selected={status === s} onClick={() => { setRows(null); setStatus(s); }}>{STATUS_LABEL[s]}</button>)}
      </div>
      {error && <p role="alert" className="auth-error">{error}</p>}
      {ok && <p role="status" className="auth-ok">{ok}</p>}
      {rows === null ? <p className="empty">Loading…</p> : rows.length === 0 ? <div className="empty-state"><h2>Nothing here.</h2><p>No experiences with the status &ldquo;{STATUS_LABEL[status]}&rdquo;.</p></div> : (
        <ul className="mylist">
          {rows.map((x) => (
            <li key={x.id} className="myrow">
              <div>
                <h3><Link href={`/experience/${x.id}`}>{x.company.name}</Link> <span className="muted">· {x.role} · {x.interviewYear}</span></h3>
                <p className="xcard-meta"><span className={`chip ${OUTCOME_CLASS[x.outcome]}`}>{OUTCOME_LABEL[x.outcome]}</span><span>{x.roundCount} {x.roundCount === 1 ? "round" : "rounds"}</span><span>{authorLabel(x.author)}</span><span>{shortDate(x.createdAt)}</span>{x.openReports > 0 && <span className="chip bad">{x.openReports} open {x.openReports === 1 ? "report" : "reports"}</span>}</p>
                {x.reviewNote && <p className="rnote">Note: {x.reviewNote}</p>}
                {rejecting === x.id && (
                  <form className="reject-form" onSubmit={(e) => { e.preventDefault(); void decide(x.id, "reject", note); }}>
                    <label><span className="mono">Reason shown to the author</span><input required value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} /></label>
                    <div className="xbtns"><button className="btn btn-primary small" disabled={busy}>Send rejection</button><button type="button" className="btn btn-ghost small" onClick={() => setRejecting(null)}>Cancel</button></div>
                  </form>
                )}
              </div>
              <div className="myside">
                {ACTIONS[status].map((a) => (
                  <button key={a.action} className={`btn small ${a.action === "approve" || a.action === "reinstate" ? "btn-primary" : "btn-ghost"}`} disabled={busy}
                    onClick={() => (a.action === "reject" ? setRejecting(x.id) : decide(x.id, a.action))}>{a.label}</button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
