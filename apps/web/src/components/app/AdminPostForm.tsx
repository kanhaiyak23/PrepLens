"use client";

import { useState } from "react";
import { BRANCHES, CAMPUSES, DRIVE_TYPES, OUTCOMES, type AdminPostDto } from "@preplens/shared";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import { CAMPUS_LABEL, DRIVE_LABEL, OUTCOME_LABEL } from "@/lib/format";

const THIS_YEAR = new Date().getFullYear();

/** Post an experience for a student who has agreed to it (for example a student from another campus). Published at once, logged. */
export function AdminPostForm() {
  const { token } = useAuth();
  const [f, setF] = useState({ company: "", role: "SDE", driveType: "on-campus", outcome: "selected", year: String(THIS_YEAR), campus: "ru", authorName: "", authorBatch: "", authorBranch: "CSE", anon: false, text: "", consented: false });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true); setMsg(null);
    const body: AdminPostDto = {
      mode: "quick", company: f.company, role: f.role, driveType: f.driveType as never, interviewYear: Number(f.year), outcome: f.outcome as never,
      isAnonymous: f.anon, freeText: f.text, studentConsented: true, authorName: f.authorName, authorBatch: Number(f.authorBatch), authorBranch: f.authorBranch as never, campus: f.campus as never,
    };
    try {
      await api("/api/v1/admin/experiences", { token, method: "POST", body });
      setMsg({ ok: true, text: "Posted. It is public now and recorded in the log." });
      setF((s) => ({ ...s, company: "", text: "", authorName: "", authorBatch: "", consented: false }));
    } catch (err) { setMsg({ ok: false, text: (err as ApiError).message }); } finally { setBusy(false); }
  }

  return (
    <section className="admin-block">
      <details>
        <summary className="mono">Post on behalf of a student</summary>
        <form onSubmit={submit} className="sform" style={{ marginTop: 16 }}>
          <div className="sgrid">
            <label><span className="mono">Company</span><input required value={f.company} onChange={(e) => set("company", e.target.value)} /></label>
            <label><span className="mono">Role</span><input required value={f.role} onChange={(e) => set("role", e.target.value)} /></label>
            <label><span className="mono">Drive</span><select value={f.driveType} onChange={(e) => set("driveType", e.target.value)}>{DRIVE_TYPES.map((d) => <option key={d} value={d}>{DRIVE_LABEL[d]}</option>)}</select></label>
            <label><span className="mono">Outcome</span><select value={f.outcome} onChange={(e) => set("outcome", e.target.value)}>{OUTCOMES.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}</select></label>
            <label><span className="mono">Year</span><select value={f.year} onChange={(e) => set("year", e.target.value)}>{Array.from({ length: 5 }, (_, i) => THIS_YEAR - i).map((y) => <option key={y}>{y}</option>)}</select></label>
            <label><span className="mono">Campus</span><select value={f.campus} onChange={(e) => set("campus", e.target.value)}>{CAMPUSES.map((c) => <option key={c} value={c}>{CAMPUS_LABEL[c]}</option>)}</select></label>
            <label><span className="mono">Student name</span><input required value={f.authorName} onChange={(e) => set("authorName", e.target.value)} /></label>
            <label><span className="mono">Student batch</span><input required type="number" min={2000} max={2100} value={f.authorBatch} onChange={(e) => set("authorBatch", e.target.value)} /></label>
            <label><span className="mono">Student branch</span><select value={f.authorBranch} onChange={(e) => set("authorBranch", e.target.value)}>{BRANCHES.map((b) => <option key={b}>{b}</option>)}</select></label>
          </div>
          <label><span className="mono">What happened</span><textarea required rows={5} maxLength={4000} value={f.text} onChange={(e) => set("text", e.target.value)} /></label>
          <label className="check"><input type="checkbox" checked={f.anon} onChange={(e) => set("anon", e.target.checked)} /><span>Show as anonymous (batch only)</span></label>
          <label className="check consent-box"><input type="checkbox" required checked={f.consented} onChange={(e) => set("consented", e.target.checked)} /><span>The student has agreed to this being public on the internet and knows they can ask for it to be withdrawn.</span></label>
          {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "auth-ok" : "auth-error"}>{msg.text}</p>}
          <button className="btn btn-primary" disabled={busy || !f.consented}>{busy ? "Posting…" : "Post now"}</button>
        </form>
      </details>
    </section>
  );
}
