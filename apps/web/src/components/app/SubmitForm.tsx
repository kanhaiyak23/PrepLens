"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DRIVE_TYPES, OUTCOMES, type CompanySummary, type MeResponse, type SubmissionDto } from "@preplens/shared";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import { DRIVE_LABEL, OUTCOME_LABEL } from "@/lib/format";
import { RoundsEditor, emptyRound, type R } from "./RoundsEditor";

const THIS_YEAR = new Date().getFullYear();
const CONSENT = "This will be publicly visible on the internet, including to recruiters and search engines. You can unpublish it at any time.";

export function SubmitForm() {
  const router = useRouter();
  const { token, loading } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [mode, setMode] = useState<"quick" | "detailed">("quick");
  const [company, setCompany] = useState("");
  const [suggest, setSuggest] = useState<CompanySummary[]>([]);
  const [role, setRole] = useState("SDE");
  const [driveType, setDriveType] = useState<(typeof DRIVE_TYPES)[number]>("on-campus");
  const [year, setYear] = useState(String(THIS_YEAR));
  const [month, setMonth] = useState("");
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]>("selected");
  const [anon, setAnon] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [rounds, setRounds] = useState<R[]>([emptyRound()]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!token) { router.replace("/signin?next=/submit"); return; }
    api<MeResponse>("/api/v1/me", { token }).then(setMe).catch((e: ApiError) => setError(e.message));
  }, [loading, token, router]);

  // company autocomplete: prefix search against the public API
  useEffect(() => {
    const t = setTimeout(() => {
      if (company.trim().length < 1) return setSuggest([]);
      api<CompanySummary[]>(`/api/v1/companies?prefix=${encodeURIComponent(company.trim())}&limit=8`).then(setSuggest).catch(() => setSuggest([]));
    }, 200);
    return () => clearTimeout(t);
  }, [company]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true); setError(null); setFields({});
    const base = { company, role, driveType, interviewYear: Number(year), ...(month ? { interviewMonth: Number(month) } : {}), outcome, isAnonymous: anon, consent: true as const };
    const body: SubmissionDto =
      mode === "quick"
        ? { mode: "quick", ...base, freeText }
        : { mode: "detailed", ...base, rounds: rounds.map((r) => ({ name: r.name, ...(r.tips.trim() ? { tips: r.tips } : {}), questions: r.questions.filter((q) => q.text.trim()).map((q) => ({ text: q.text, ...(q.topic.trim() ? { topic: q.topic } : {}) })) })) };
    try {
      const r = await api<{ id: string }>("/api/v1/experiences", { token, method: "POST", body });
      setDone(r.id);
    } catch (err) {
      const a = err as ApiError;
      setError(a.message);
      setFields(a.fields ?? {});
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="empty-state">
        <h2>Thank you. It is waiting for review.</h2>
        <p>An admin will look at it before it goes public. You can follow its status, or withdraw it, from My posts.</p>
        <div className="xbtns"><Link className="btn btn-primary" href="/me">My posts</Link><Link className="btn btn-ghost" href="/archive">Back to the archive</Link></div>
      </div>
    );
  }
  if (!me) return <p className="empty">{error ?? "Checking your account…"}</p>;
  if (!me.profileComplete) {
    return (
      <div className="empty-state">
        <h2>One thing first.</h2>
        <p>Add your graduation batch and branch so your post can be labelled correctly. Anonymous posts show the batch only.</p>
        <Link className="btn btn-primary" href="/welcome">Complete your profile</Link>
      </div>
    );
  }

  const err = (k: string) => fields[k] && <span className="field-err">{fields[k]}</span>;

  return (
    <form onSubmit={submit} className="sform">
      <div className="seg" role="tablist" aria-label="How do you want to write it?">
        <button type="button" role="tab" aria-selected={mode === "quick"} onClick={() => setMode("quick")}>Quick note</button>
        <button type="button" role="tab" aria-selected={mode === "detailed"} onClick={() => setMode("detailed")}>Round by round</button>
        <span className="seg-thumb" style={{ transform: `translateX(${mode === "quick" ? 0 : 100}%)` }} aria-hidden="true" />
      </div>

      <div className="sgrid">
        <label><span className="mono">Company</span>
          <input id="company" required list="companies" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Start typing" autoComplete="off" />
          <datalist id="companies">{suggest.map((c) => <option key={c.slug} value={c.name} />)}</datalist>{err("company")}
          <small>Can&apos;t find it? Type the name. A new company waits for an admin to approve it.</small>
        </label>
        <label><span className="mono">Role</span><input id="role" required value={role} onChange={(e) => setRole(e.target.value)} />{err("role")}</label>
        <label><span className="mono">Drive</span>
          <select id="drive" value={driveType} onChange={(e) => setDriveType(e.target.value as typeof driveType)}>{DRIVE_TYPES.map((d) => <option key={d} value={d}>{DRIVE_LABEL[d]}</option>)}</select></label>
        <label><span className="mono">Outcome</span>
          <select id="outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>{OUTCOMES.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}</select></label>
        <label><span className="mono">Year</span>
          <select id="year" value={year} onChange={(e) => setYear(e.target.value)}>{Array.from({ length: 5 }, (_, i) => THIS_YEAR - i).map((y) => <option key={y}>{y}</option>)}</select>{err("interviewYear")}</label>
        <label><span className="mono">Month (optional)</span>
          <select id="month" value={month} onChange={(e) => setMonth(e.target.value)}><option value="">Not sure</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Date(2000, i).toLocaleString("en", { month: "long" })}</option>)}</select></label>
      </div>

      {mode === "quick" ? (
        <label><span className="mono">What happened?</span>
          <textarea id="freeText" required rows={8} maxLength={4000} value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder="The rounds in order, what each one asked, and what you would tell a junior." />{err("freeText")}
          <small>No interviewer names. No confidential assessment questions pasted word for word.</small>
        </label>
      ) : (
        <>
          <RoundsEditor rounds={rounds} onChange={setRounds} />
          {err("rounds")}
        </>
      )}

      <label className="check"><input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} /><span>Post anonymously. Readers will see your batch only, never your name or branch.</span></label>

      <div className="consent-box">
        <p>{CONSENT}</p>
        <label className="check"><input id="consent" type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>I understand and agree</span></label>
        {err("consent")}
      </div>

      {error && <p role="alert" className="auth-error">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={busy || !consent}>{busy ? "Submitting…" : "Submit for review"}</button>
    </form>
  );
}
