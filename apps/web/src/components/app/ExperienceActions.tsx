"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { REPORT_REASONS, type ExperienceDetail, type InteractionState, type ReportReason } from "@preplens/shared";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";

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

  const panel = "bg-surface-container-lowest border border-surface-variant rounded-xl p-5 space-y-3";

  if (loading) return <aside className="space-y-4" aria-busy="true" />;

  if (!token) {
    return (
      <aside className="space-y-4">
        <div className={panel}>
          <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Community actions</p>
          <p className="text-sm text-on-surface-variant">Find this useful? Sign in to mark it helpful, save it, or report a problem.</p>
          <ButtonLink href={`/signin?next=/experience/${id}`} className="w-full">Sign in with Google</ButtonLink>
        </div>
      </aside>
    );
  }

  const canReact = !me?.status || me.status === "published";
  return (
    <aside className="space-y-4">
      {canReact && (
        <div className={panel}>
          <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Community actions</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant={voted ? "primary" : "secondary"} aria-pressed={voted} disabled={busy} onClick={toggleVote}><Icon name="thumb_up" className="!text-base" />Helpful ({votes})</Button>
            <Button variant={saved ? "primary" : "secondary"} aria-pressed={saved} disabled={busy} onClick={toggleBookmark}><Icon name="bookmark" className="!text-base" />{saved ? "Saved" : "Save"}</Button>
          </div>
          {!me?.isOwner && !reporting && <button className="w-full text-xs text-on-surface-variant hover:text-on-surface flex items-center justify-center gap-1 cursor-pointer" onClick={() => setReporting(true)}><Icon name="flag" className="!text-sm" />Report this post</button>}
          {reporting && (
            <form onSubmit={sendReport} className="grid gap-3">
              <label><span>What is wrong?</span>
                <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>{REPORT_REASONS.map((r) => <option key={r} value={r}>{REASON_LABEL[r]}</option>)}</select>
              </label>
              <label><span>Details (optional)</span><input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} /></label>
              <div className="flex gap-2"><Button disabled={busy} size="sm">Send report</Button><Button type="button" variant="quiet" size="sm" onClick={() => setReporting(false)}>Cancel</Button></div>
            </form>
          )}
        </div>
      )}

      {(me?.status || me?.allowedActions?.length) && (
        <div className={panel}>
          <p className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Author view {me?.status && <Badge tone={STATUS_TONE[me.status]} dot>{STATUS_LABEL[me.status]}</Badge>}</p>
          {me?.reviewNote && <Notice kind="error" title="Reviewer note">{me.reviewNote}</Notice>}
          {me?.allowedActions?.includes("cancel-update") && (
            <div className="space-y-2"><Badge tone="info">Change waiting for review</Badge><p className="text-xs text-on-surface-variant">Readers still see the approved version.</p><Button variant="secondary" size="sm" disabled={busy} onClick={cancelPending}>Cancel my change</Button></div>
          )}
          {me?.isOwner && me.updateReviewNote && <Notice kind="error" title="Your last change was not approved">{me.updateReviewNote}</Notice>}
          {me?.allowedActions?.includes("edit") && <ButtonLink href={`/experience/${id}/edit`} variant="secondary" className="w-full"><Icon name="edit" className="!text-base" />Edit or update result</ButtonLink>}
          {me?.allowedActions?.includes("withdraw") && <Button variant="danger" className="w-full" disabled={busy} onClick={() => visibility(false)}><Icon name="delete" className="!text-base" />Withdraw interview</Button>}
          {me?.allowedActions?.includes("republish") && <Button className="w-full" disabled={busy} onClick={() => visibility(true)}>Send for review again</Button>}
        </div>
      )}

      {me && (
        <div className={panel}>
          <p className="font-semibold">{me.company.name}</p>
          <p className="text-sm text-on-surface-variant">See what every round at {me.company.name} has asked, plus an AI prep guide written from the posts.</p>
          <Link href={`/company/${me.company.slug}`} className="text-sm font-semibold text-primary hover:underline">View {me.company.name} prep guide →</Link>
        </div>
      )}
      {msg && <Notice kind={msg.ok ? "success" : "error"}>{msg.text}</Notice>}
    </aside>
  );
}
