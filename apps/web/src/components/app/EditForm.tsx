"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DRIVE_TYPES, OUTCOMES, type ExperienceDetail, type ExperienceUpdateDto, type UpdateResult } from "@preplens/shared";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import { DRIVE_LABEL, OUTCOME_LABEL } from "@/lib/format";
import { RoundsEditor, type R } from "./RoundsEditor";

const THIS_YEAR = new Date().getFullYear();
const toRounds = (x: ExperienceDetail): R[] => x.rounds.map((r) => ({ name: r.name, tips: r.tips ?? "", questions: r.questions.map((q) => ({ text: q.text, topic: q.topic ?? "" })) }));
const clean = (rs: R[]) => rs.map((r) => ({ name: r.name.trim(), tips: r.tips.trim(), questions: r.questions.filter((q) => q.text.trim()).map((q) => ({ text: q.text.trim(), topic: q.topic.trim() })) }));

/**
 * Edit or update the result of your own post. Only the fields you changed are sent.
 * A live post queues the change for review and readers keep seeing the approved version; a post that is not live yet is edited directly.
 */
export function EditForm({ id }: { id: string }) {
  const router = useRouter();
  const { token, loading } = useAuth();
  const [orig, setOrig] = useState<ExperienceDetail | null>(null);
  const [role, setRole] = useState("");
  const [drive, setDrive] = useState<(typeof DRIVE_TYPES)[number]>("on-campus");
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]>("selected");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [anon, setAnon] = useState(false);
  const [rounds, setRounds] = useState<R[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<UpdateResult["result"] | "same" | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!token) { router.replace(`/signin?next=/experience/${id}/edit`); return; }
    api<ExperienceDetail>(`/api/v1/experiences/${id}`, { token })
      .then((x) => {
        setOrig(x); setRole(x.role); setDrive(x.driveType); setOutcome(x.outcome); setYear(String(x.interviewYear)); setMonth(x.interviewMonth ? String(x.interviewMonth) : "");
        setAnon(Boolean(x.isAnonymous)); setRounds(toRounds(x));
      })
      .catch((e: ApiError) => setError(e.message));
  }, [loading, token, id, router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !orig) return;
    const body: ExperienceUpdateDto = {};
    if (role.trim() !== orig.role) body.role = role.trim();
    if (drive !== orig.driveType) body.driveType = drive;
    if (outcome !== orig.outcome) body.outcome = outcome;
    if (Number(year) !== orig.interviewYear) body.interviewYear = Number(year);
    if ((month ? Number(month) : null) !== orig.interviewMonth) body.interviewMonth = month ? Number(month) : null;
    if (anon !== Boolean(orig.isAnonymous)) body.isAnonymous = anon;
    if (JSON.stringify(clean(rounds)) !== JSON.stringify(clean(toRounds(orig)))) body.rounds = clean(rounds).map((r) => ({ name: r.name, ...(r.tips ? { tips: r.tips } : {}), questions: r.questions.map((q) => ({ text: q.text, ...(q.topic ? { topic: q.topic } : {}) })) }));
    if (Object.keys(body).length === 0) { setDone("same"); return; }
    setBusy(true); setError(null);
    try {
      const r = await api<UpdateResult>(`/api/v1/experiences/${id}`, { token, method: "PATCH", body });
      setDone(r.result);
    } catch (err) { setError((err as ApiError).message); } finally { setBusy(false); }
  }

  if (!orig) return <p className="empty">{error ?? "Loading…"}</p>;
  if (!orig.isOwner) return <div className="empty-state"><h2>Only the author can edit this.</h2><Link className="btn btn-primary" href={`/experience/${id}`}>Back to the experience</Link></div>;

  if (done) {
    const text = done === "queued" ? "Your change is waiting for review. Readers keep seeing the approved version until an admin approves it."
      : done === "applied" ? "Saved."
      : "Nothing was different, so nothing was sent.";
    return (
      <div className="empty-state"><h2>{done === "same" ? "No changes." : "Done."}</h2><p>{text}</p>
        <div className="xbtns"><Link className="btn btn-primary" href={`/experience/${id}`}>Back to the experience</Link><Link className="btn btn-ghost" href="/me">My posts</Link></div></div>
    );
  }

  return (
    <form onSubmit={save} className="sform">
      {orig.status === "rejected" && <p className="auth-ok" role="note">This post was not approved. Fix what the reviewer asked for and save: it goes back to the review queue.</p>}
      {orig.status === "unpublished" && <p className="auth-ok" role="note">This post is withdrawn. Save your changes, then use Send for review again on the post page.</p>}
      {orig.status === "published" && <p className="auth-ok" role="note">This post is live. Your changes will be reviewed before readers see them. Making it anonymous applies at once.</p>}
      <div className="sgrid">
        <label><span className="mono">Role</span><input id="role" required value={role} onChange={(e) => setRole(e.target.value)} /></label>
        <label><span className="mono">Outcome</span><select id="outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>{OUTCOMES.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}</select></label>
        <label><span className="mono">Drive</span><select id="drive" value={drive} onChange={(e) => setDrive(e.target.value as typeof drive)}>{DRIVE_TYPES.map((d) => <option key={d} value={d}>{DRIVE_LABEL[d]}</option>)}</select></label>
        <label><span className="mono">Year</span><select id="year" value={year} onChange={(e) => setYear(e.target.value)}>{Array.from({ length: 6 }, (_, i) => THIS_YEAR - i).map((y) => <option key={y}>{y}</option>)}</select></label>
        <label><span className="mono">Month</span><select id="month" value={month} onChange={(e) => setMonth(e.target.value)}><option value="">Not sure</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Date(2000, i).toLocaleString("en", { month: "long" })}</option>)}</select></label>
      </div>
      <RoundsEditor rounds={rounds} onChange={setRounds} />
      <label className="check"><input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} /><span>Anonymous. Readers see your batch only.</span></label>
      {error && <p role="alert" className="auth-error">{error}</p>}
      <div className="xbtns"><button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button><Link className="btn btn-ghost" href={`/experience/${id}`}>Cancel</Link></div>
    </form>
  );
}
