"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { REPORT_REASONS, type ExperienceDetail, type InteractionState, type ReportReason } from "@preplens/shared";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/format";

const REASON_LABEL: Record<ReportReason, string> = {
  "interviewer-named": "Names an interviewer",
  confidential: "Shares confidential material",
  false: "Looks false",
  abusive: "Abusive",
  other: "Something else",
};

/** Everything that needs a signed-in user: vote, bookmark, report, and the author's own controls. */
export function ExperienceActions({ id, initialUpvotes }: { id: string; initialUpvotes: number }) {
  const { token, loading } = useAuth();
  const [me, setMe] = useState<ExperienceDetail | null>(null);
  const [state, setState] = useState<InteractionState>({ voted: [], bookmarked: [] });
  const [votes, setVotes] = useState(initialUpvotes);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ReportReason>("abusive");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const say = (e: unknown) => setMsg({ ok: false, text: e instanceof ApiError ? e.message : "Something went wrong." });

  useEffect(() => {
    if (!token) return;
    api<ExperienceDetail>(`/api/v1/experiences/${id}`, { token }).then(setMe).catch(() => {});
    api<InteractionState>(`/api/v1/me/interactions?ids=${id}`, { token }).then(setState).catch(() => {});
  }, [id, token]);

  const voted = state.voted.includes(id);
  const saved = state.bookmarked.includes(id);

  async function toggleVote() {
    if (!token) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api<{ voted: boolean; upvoteCount: number }>(`/api/v1/experiences/${id}/vote`, { token, method: voted ? "DELETE" : "PUT" });
      setVotes(r.upvoteCount);
      setState((s) => ({ ...s, voted: r.voted ? [id] : [] }));
    } catch (e) { say(e); } finally { setBusy(false); }
  }
  async function toggleBookmark() {
    if (!token) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api<{ bookmarked: boolean }>(`/api/v1/experiences/${id}/bookmark`, { token, method: saved ? "DELETE" : "PUT" });
      setState((s) => ({ ...s, bookmarked: r.bookmarked ? [id] : [] }));
    } catch (e) { say(e); } finally { setBusy(false); }
  }
  async function sendReport(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true); setMsg(null);
    try {
      await api(`/api/v1/experiences/${id}/reports`, { token, method: "POST", body: { reason, ...(note.trim() ? { note: note.trim() } : {}) } });
      setReporting(false); setNote("");
      setMsg({ ok: true, text: "Thanks. An admin will review this report." });
    } catch (err) { say(err); } finally { setBusy(false); }
  }
  async function cancelPending() {
    if (!token) return;
    setBusy(true); setMsg(null);
    try {
      await api(`/api/v1/experiences/${id}/update`, { token, method: "DELETE" });
      api<ExperienceDetail>(`/api/v1/experiences/${id}`, { token }).then(setMe).catch(() => {});
      setMsg({ ok: true, text: "Your waiting change was cancelled." });
    } catch (e) { say(e); } finally { setBusy(false); }
  }
  async function visibility(publish: boolean) {
    if (!token) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api<{ status: ExperienceDetail["status"] }>(`/api/v1/experiences/${id}/${publish ? "republish" : "unpublish"}`, { token, method: "POST" });
      setMe((m) => (m ? { ...m, status: r.status } : m));
      api<ExperienceDetail>(`/api/v1/experiences/${id}`, { token }).then(setMe).catch(() => {});
      setMsg({ ok: true, text: publish ? "Sent for review again." : "Withdrawn. It is no longer public." });
    } catch (e) { say(e); } finally { setBusy(false); }
  }

  if (loading) return <aside className="xaside" aria-busy="true" />;

  if (!token) {
    return (
      <aside className="xaside">
        <p>Find this useful? Sign in to mark it helpful, save it, or report a problem.</p>
        <Link className="btn btn-primary" href={`/signin?next=/experience/${id}`}>Sign in with Google</Link>
      </aside>
    );
  }

  return (
    <aside className="xaside">
      {me?.status && (
        <div className="xstatus">
          <span className={`chip ${STATUS_CLASS[me.status]}`}>{STATUS_LABEL[me.status]}</span>
          {me.reviewNote && <p>Reviewer note: {me.reviewNote}</p>}
        </div>
      )}
      {(!me?.status || me.status === "published") && (
        <div className="xbtns">
          <button className={`btn ${voted ? "btn-primary" : "btn-ghost"}`} aria-pressed={voted} disabled={busy} onClick={toggleVote}>
            {voted ? "Marked helpful" : "Mark helpful"} · {votes}
          </button>
          <button className={`btn ${saved ? "btn-primary" : "btn-ghost"}`} aria-pressed={saved} disabled={busy} onClick={toggleBookmark}>
            {saved ? "Saved" : "Save for later"}
          </button>
          {!me?.isOwner && !reporting && <button className="btn btn-ghost" onClick={() => setReporting(true)}>Report</button>}
        </div>
      )}
      {reporting && (
        <form onSubmit={sendReport} className="auth-form">
          <label><span className="mono">What is wrong?</span>
            <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
              {REPORT_REASONS.map((r) => <option key={r} value={r}>{REASON_LABEL[r]}</option>)}
            </select>
          </label>
          <label><span className="mono">Details (optional)</span><input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="xbtns"><button className="btn btn-primary" disabled={busy}>Send report</button><button type="button" className="btn btn-ghost" onClick={() => setReporting(false)}>Cancel</button></div>
        </form>
      )}
      {me?.allowedActions?.includes("cancel-update") && (
        <div className="xstatus">
          <span className="chip blue">Change waiting for review</span>
          <p>Readers still see the approved version.</p>
          <button className="btn btn-ghost small" disabled={busy} onClick={cancelPending}>Cancel my change</button>
        </div>
      )}
      {me?.isOwner && me.updateReviewNote && <p className="rnote">Your last change was not approved: {me.updateReviewNote}</p>}
      {me?.allowedActions?.includes("edit") && <Link className="btn btn-ghost" href={`/experience/${id}/edit`}>Edit or update result</Link>}
      {(me?.allowedActions?.includes("withdraw") || me?.allowedActions?.includes("republish")) && (
        <div className="xbtns">
          {me?.allowedActions?.includes("withdraw") && <button className="btn btn-ghost" disabled={busy} onClick={() => visibility(false)}>Withdraw</button>}
          {me?.allowedActions?.includes("republish") && <button className="btn btn-primary" disabled={busy} onClick={() => visibility(true)}>Send for review again</button>}
        </div>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "auth-ok" : "auth-error"}>{msg.text}</p>}
    </aside>
  );
}
