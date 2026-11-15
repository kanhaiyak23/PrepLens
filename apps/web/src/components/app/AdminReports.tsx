"use client";

import { useEffect, useState } from "react";
import type { AdminReport } from "@preplens/shared";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import { shortDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { AdminEmpty, AdminRow, AdminSection } from "./AdminRow";

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

  if (rows === null) return <p className="text-on-surface-variant">Loading…</p>;
  return (
    <AdminSection title="Open reports" hint="Students flagged these posts. Dismiss a report if it is wrong, or remove the post, which settles every open report on it.">
      {msg && <Notice kind={msg.ok ? "success" : "error"}>{msg.text}</Notice>}
      {rows.length === 0 ? <AdminEmpty>No open reports.</AdminEmpty> : (
        <ul className="p-0 m-0 grid gap-4">
          {rows.map((x) => (
            <AdminRow key={x.id} danger title={x.companyName} href={`/experience/${x.experienceId}`} subtitle={x.role}
              badges={<Badge tone="danger">{REASON[x.reason] ?? x.reason}</Badge>} meta={[`Reported ${shortDate(x.createdAt)}`]}
              actions={<>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(`/api/v1/admin/reports/${x.id}/dismiss`, "Report dismissed.")}>Dismiss</Button>
                {x.experienceStatus === "published" && <Button size="sm" variant="danger" disabled={busy} onClick={() => act(`/api/v1/admin/experiences/${x.experienceId}/remove`, "Post removed. Its open reports are settled.")}>Remove post</Button>}
              </>}>
              {x.note && <p className="text-sm bg-surface-container-low rounded-xl px-4 py-3">&ldquo;{x.note}&rdquo;</p>}
            </AdminRow>
          ))}
        </ul>
      )}
    </AdminSection>
  );
}
