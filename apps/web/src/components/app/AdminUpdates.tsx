"use client";

import { useEffect, useState } from "react";
import type { AdminUpdate } from "@preplens/shared";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import { OUTCOME_LABEL, shortDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { AdminEmpty, AdminRow, AdminSection, RejectForm } from "./AdminRow";

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

  if (rows === null) return <p className="text-on-surface-variant">Loading…</p>;
  return (
    <AdminSection title="Edits waiting for review" hint="Authors changed a post that is already live. Readers keep seeing the approved version until you approve the change.">
      {msg && <Notice kind={msg.ok ? "success" : "error"}>{msg.text}</Notice>}
      {rows.length === 0 ? <AdminEmpty>No edits are waiting.</AdminEmpty> : (
        <ul className="p-0 m-0 grid gap-4">
          {rows.map((x) => (
            <AdminRow key={x.id} title={x.company.name} href={`/experience/${x.id}`} subtitle={x.role} meta={[`Submitted ${shortDate(x.submittedAt)}`]}
              actions={<><Button size="sm" disabled={busy} onClick={() => decide(x.id, "approve")}>Approve</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => setReject(x.id)}>Reject</Button></>}>
              <ul className="m-0 pl-5 list-disc text-sm space-y-1">{summarise(x).map((t) => <li key={t}>{t}</li>)}</ul>
              {reject === x.id && <RejectForm note={note} onNote={setNote} busy={busy} onSubmit={() => void decide(x.id, "reject")} onCancel={() => setReject(null)} />}
            </AdminRow>
          ))}
        </ul>
      )}
    </AdminSection>
  );
}
