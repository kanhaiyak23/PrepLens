"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DRIVE_TYPES, OUTCOMES, type CompanySummary, type MeResponse, type SubmissionDto } from "@preplens/shared";
import { useAuth } from "@/hooks/useAuth";
import { loadMe } from "@/hooks/useMe";
import { api, ApiError } from "@/lib/api";
import { DRIVE_LABEL, OUTCOME_LABEL } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Segmented } from "@/components/ui/Segmented";
import { Tabs } from "@/components/ui/Tabs";
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
    loadMe(token).then(setMe).catch((e: ApiError) => setError(e.message));
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
      <div className="bg-surface-container-low rounded-2xl p-10 text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Icon name="check_circle" className="!text-3xl" /></div>
        <h2 className="text-xl font-bold">Thank you. It is waiting for review.</h2>
        <p className="text-sm text-on-surface-variant max-w-md mx-auto">An admin will look at it before it goes public. You can follow its status, or withdraw it, from My posts.</p>
        <div className="flex justify-center gap-3 pt-2"><ButtonLink href="/me">My posts</ButtonLink><ButtonLink href="/archive" variant="secondary">Back to experiences</ButtonLink></div>
      </div>
    );
  }
  if (!me) return <p className="text-on-surface-variant">{error ?? "Checking your account…"}</p>;
  if (!me.profileComplete) {
    return (
      <div className="space-y-4">
        <Notice title="Your graduation year or branch is missing.">Add them so your post can be labelled correctly. Anonymous posts show the batch only.</Notice>
        <ButtonLink href="/profile">Complete your profile <Icon name="arrow_forward" className="!text-base" /></ButtonLink>
      </div>
    );
  }

  const err = (k: string) => fields[k] && <span className="field-err">{fields[k]}</span>;
  const card = "bg-surface-container-lowest border border-surface-variant rounded-2xl p-5 sm:p-7 space-y-5";

  return (
    <form onSubmit={submit} className="space-y-8">
      <Tabs label="How do you want to write it?" active={mode} onChange={setMode} items={[{ key: "quick", label: "Quick note" }, { key: "detailed", label: "Round by round" }]} />

      {/* Design source: Stitch "Share Your Interview", card 1 "Role & Overview" */}
      <section className={card}>
        <h2 className="flex items-center gap-2 text-lg font-bold"><span className="w-6 h-6 rounded-[50%] bg-primary text-on-primary text-xs flex items-center justify-center">1</span>Role and overview</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <label><span>Company</span>
            <input id="company" required list="companies" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Start typing" autoComplete="off" />
            <datalist id="companies">{suggest.map((c) => <option key={c.slug} value={c.name} />)}</datalist>{err("company")}
            <small>Not listed? Type the name. A new company waits for an admin to approve it.</small>
          </label>
          <label><span>Role</span><input id="role" required value={role} onChange={(e) => setRole(e.target.value)} placeholder="SDE-1" />{err("role")}<small>Include the level, e.g. SDE-1 or Intern.</small></label>
        </div>
        <Segmented label="Drive type" value={driveType} onChange={setDriveType} options={DRIVE_TYPES.map((d) => ({ value: d, label: DRIVE_LABEL[d] }))} />
        <Segmented label="Outcome" value={outcome} onChange={setOutcome} options={OUTCOMES.map((o) => ({ value: o, label: OUTCOME_LABEL[o] }))} />
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <label><span>Year</span>
            <select id="year" value={year} onChange={(e) => setYear(e.target.value)}>{Array.from({ length: 5 }, (_, i) => THIS_YEAR - i).map((y) => <option key={y}>{y}</option>)}</select>{err("interviewYear")}</label>
          <label><span>Month (optional)</span>
            <select id="month" value={month} onChange={(e) => setMonth(e.target.value)}><option value="">Not sure</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Date(2000, i).toLocaleString("en", { month: "long" })}</option>)}</select></label>
        </div>
      </section>

      {/* Card 2 "Interview Rounds" */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-bold"><span className="w-6 h-6 rounded-[50%] bg-primary text-on-primary text-xs flex items-center justify-center">2</span>{mode === "quick" ? "What happened?" : "Interview rounds"}</h2>
        {mode === "quick" ? (
          <label><span className="sr-only">What happened?</span>
            <textarea id="freeText" required rows={8} maxLength={4000} value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder="The rounds in order, what each one asked, and what you would tell a junior." />{err("freeText")}
            <small>No interviewer names. No confidential assessment questions pasted word for word.</small>
          </label>
        ) : (
          <>
            <RoundsEditor rounds={rounds} onChange={setRounds} />
            {err("rounds")}
          </>
        )}
      </section>

      <section className="space-y-4">
        <label className="check bg-surface-container-low rounded-xl p-4"><input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} /><span><b>Post anonymously</b><br /><span className="text-on-surface-variant">Readers will see only your batch (for example Anonymous · 2027), never your name or branch.</span></span></label>
        {/* The consent sentence must sit directly above the submit button (project rule). */}
        <div className="consent-box">
          <label className="check"><input id="consent" type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>{CONSENT}</span></label>
          {err("consent")}
        </div>
        {error && <Notice kind="error">{error}</Notice>}
        <div className="flex justify-end"><Button type="submit" disabled={busy || !consent}>{busy ? "Submitting…" : "Submit for review"}<Icon name="send" className="!text-base" /></Button></div>
      </section>

      <p className="flex gap-3 bg-surface-container-low rounded-xl p-4 text-xs text-on-surface-variant"><Icon name="gavel" className="text-primary" /><span><b className="text-on-surface">Community guidelines.</b> No interviewer names, no confidential company documents or code, nobody&apos;s personal salary. Posts that break these rules are rejected in review.</span></p>
    </form>
  );
}
