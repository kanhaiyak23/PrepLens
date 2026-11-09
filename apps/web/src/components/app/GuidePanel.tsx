"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GuideView } from "@preplens/shared";
import { api, ApiError } from "@/lib/api";
import { OUTCOME_CLASS, OUTCOME_LABEL, authorLabel } from "@/lib/format";

type State = { kind: "loading" } | { kind: "ok"; g: GuideView } | { kind: "none"; message: string } | { kind: "error"; message: string };

/** The AI prep guide. Every claim shows the numbered experiences it came from; counts are computed from the posts, not generated. */
export function GuidePanel({ slug }: { slug: string }) {
  const [s, setS] = useState<State>({ kind: "loading" });
  const [hl, setHl] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    api<GuideView>(`/api/v1/companies/${slug}/guide`)
      .then((g) => live && setS({ kind: "ok", g }))
      .catch((e: ApiError) => live && setS(e.code === "NOT_ENOUGH_DATA" ? { kind: "none", message: e.message } : { kind: "error", message: e.status === 503 ? "The AI guide is not available right now. The experiences on this page are still the real source." : e.message }));
    return () => { live = false; };
  }, [slug]);

  if (s.kind === "loading") return <section className="gpanel" aria-busy="true"><p className="empty">Reading the experiences and writing the guide…</p></section>;
  if (s.kind === "none") return <section className="gpanel"><h2>Prep guide</h2><p className="muted">{s.message} Share yours to help build it.</p><Link className="btn btn-primary small" href="/submit">Share your interview</Link></section>;
  if (s.kind === "error") return <section className="gpanel"><h2>Prep guide</h2><p className="muted">{s.message}</p></section>;

  const { g } = s;
  const cite = (n: number) => (
    <button key={n} type="button" className="cite" data-on={hl === n} aria-label={`Source ${n}`} onMouseEnter={() => setHl(n)} onMouseLeave={() => setHl(null)} onFocus={() => setHl(n)} onBlur={() => setHl(null)}>
      {n}
    </button>
  );

  return (
    <section className="gpanel" aria-label="Prep guide">
      <div className="gp-head"><h2>Prep guide</h2><span className="mono muted">Written from {g.stats.experienceCount} experiences</span></div>
      {g.stale && <p className="auth-error">This guide could not be refreshed just now. It still reflects experiences that are published today.</p>}
      <p className="gp-overview">{g.overview}</p>
      {g.rounds.length > 0 && (
        <ol className="gp-rounds">
          {g.rounds.map((r, i) => (
            <li key={i}><b>{r.name}</b><span>{r.focus} {r.sources.map(cite)}</span></li>
          ))}
        </ol>
      )}
      {g.tips.length > 0 && (
        <>
          <h3 className="mono">Tips</h3>
          <ul className="gp-tips">{g.tips.map((t, i) => <li key={i}>{t.text} {t.sources.map(cite)}</li>)}</ul>
        </>
      )}
      <div className="gp-facts">
        {Object.entries(g.stats.outcomes).map(([o, n]) => <span key={o} className={`chip ${OUTCOME_CLASS[o as keyof typeof OUTCOME_CLASS] ?? "idle"}`}>{OUTCOME_LABEL[o as keyof typeof OUTCOME_LABEL] ?? o} {n}</span>)}
        {g.stats.topTopics.map((t) => <span key={t.name} className="topic">{t.name} · {t.count}</span>)}
      </div>
      <p className="mono muted gp-note">Counts are calculated from the posts. The summary is written by an AI and cites its sources.</p>
      <ul className="gp-sources" aria-label="Sources">
        {g.sources.map((x) => (
          <li key={x.n} data-hl={hl === x.n}>
            <span className="mono">{x.n}</span>
            <Link href={`/experience/${x.id}`}>{x.role} · {x.interviewYear}</Link>
            <span className={`chip ${OUTCOME_CLASS[x.outcome]}`}>{OUTCOME_LABEL[x.outcome]}</span>
            <span className="muted">{authorLabel(x.author)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
