"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EXPERIENCE_STATUSES, type AdminCard, type ExperienceStatus, type MeResponse, type ModerationAction, type Page } from "@preplens/shared";
import { useAuth } from "@/hooks/useAuth";
import { loadMe } from "@/hooks/useMe";
import { api, ApiError } from "@/lib/api";
import { OUTCOME_LABEL, OUTCOME_TONE, STATUS_LABEL, authorLabel, shortDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { AdminEmpty, AdminRow, AdminSection, RejectForm } from "./AdminRow";

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
    loadMe(token).then(setMe).catch((e: ApiError) => setError(e.message));
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
    <AdminSection title="Posts" hint="Pick a status to see what is in it. Approving publishes a post; rejecting sends your reason to the author.">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Queue">
        {EXPERIENCE_STATUSES.map((s) => <button key={s} type="button" role="tab" className="pill" aria-selected={status === s} onClick={() => { setRows(null); setStatus(s); }}>{STATUS_LABEL[s]}</button>)}
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {ok && <Notice kind="success">{ok}</Notice>}
      {rows === null ? <p className="text-on-surface-variant">Loading…</p> : rows.length === 0 ? <AdminEmpty>No experiences with the status &ldquo;{STATUS_LABEL[status]}&rdquo;.</AdminEmpty> : (
        <ul className="p-0 m-0 grid gap-4">
          {rows.map((x) => (
            <AdminRow key={x.id} title={x.company.name} href={`/experience/${x.id}`} subtitle={`${x.role} · ${x.interviewYear}`}
              badges={<><Badge tone={OUTCOME_TONE[x.outcome]}>{OUTCOME_LABEL[x.outcome]}</Badge>{x.openReports > 0 && <Badge tone="danger">{x.openReports} open {x.openReports === 1 ? "report" : "reports"}</Badge>}</>}
              meta={[`${x.roundCount} ${x.roundCount === 1 ? "round" : "rounds"}`, authorLabel(x.author), `Submitted ${shortDate(x.createdAt)}`]}
              actions={ACTIONS[status].map((a) => (
                <Button key={a.action} size="sm" variant={a.action === "approve" || a.action === "reinstate" ? "primary" : a.action === "remove" ? "danger" : "secondary"} disabled={busy}
                  onClick={() => (a.action === "reject" ? setRejecting(x.id) : decide(x.id, a.action))}>{a.label}</Button>
              ))}>
              {x.reviewNote && <p className="rnote">Note: {x.reviewNote}</p>}
              {rejecting === x.id && <RejectForm note={note} onNote={setNote} busy={busy} onSubmit={() => void decide(x.id, "reject", note)} onCancel={() => setRejecting(null)} />}
            </AdminRow>
          ))}
        </ul>
      )}
    </AdminSection>
  );
}
