import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import type { CompanySummary, ExperienceCard as Card, Page } from "@preplens/shared";
import { AppHeader } from "@/components/app/AppHeader";
import { ExperienceCard } from "@/components/app/ExperienceCard";
import { Filters } from "@/components/app/Filters";
import { ServerApiError, serverFetch } from "@/lib/serverApi";

export const metadata: Metadata = { title: "Archive · PrepLens", description: "Browse NST placement interview experiences, round by round." };

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function ArchivePage({ searchParams }: { searchParams: Search }) {
  return (
    <>
      <AppHeader />
      <main id="top" className="app-page on-paper">
        <div className="wrap">
          <p className="mono eyebrow">Archive</p>
          <h1 className="display page-title">Every interview, round by round.</h1>
          <Suspense fallback={<p className="empty">Loading the archive…</p>}>
            <Results searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </>
  );
}

async function Results({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const values = { q: one(sp.q), company: one(sp.company), outcome: one(sp.outcome), year: one(sp.year), campus: one(sp.campus), role: one(sp.role), sort: one(sp.sort) };
  const cursor = one(sp.cursor);

  const qs = new URLSearchParams();
  Object.entries(values).forEach(([k, v]) => v && qs.set(k, v));
  if (cursor) qs.set("cursor", cursor);
  qs.set("limit", "12");

  let feed: Page<Card> | null = null;
  let companies: CompanySummary[] = [];
  let problem: string | null = null;
  try {
    [feed, { data: companies }] = await Promise.all([serverFetch<Page<Card>>(`/api/v1/experiences?${qs}`), serverFetch<{ data: CompanySummary[] }>("/api/v1/companies?limit=50")]);
  } catch (e) {
    problem = e instanceof ServerApiError ? e.message : "Something went wrong.";
  }

  const next = new URLSearchParams();
  Object.entries(values).forEach(([k, v]) => v && next.set(k, v));
  if (feed?.page.nextCursor) next.set("cursor", feed.page.nextCursor);

  return (
    <>
      <Filters values={values} companies={companies} />
      {problem && <p role="alert" className="auth-error">{problem}</p>}
      {feed && feed.data.length === 0 && !cursor && (
        <div className="empty-state">
          <h2>Nothing here yet.</h2>
          <p>{Object.values(values).some(Boolean) ? "No published experiences match these filters." : "No experiences are published yet. Be the first to share one."}</p>
          <Link className="btn btn-primary" href="/submit">Share your interview</Link>
        </div>
      )}
      {feed && feed.data.length > 0 && (
        <>
          <ul className="xgrid">{feed.data.map((x) => <ExperienceCard key={x.id} x={x} />)}</ul>
          <nav className="pager" aria-label="Pages">
            {cursor && <Link className="btn btn-ghost" href={`/archive?${new URLSearchParams(Object.entries(values).filter(([, v]) => v) as [string, string][])}`}>Back to newest</Link>}
            {feed.page.hasMore && <Link className="btn btn-primary" href={`/archive?${next}`}>Older experiences</Link>}
          </nav>
        </>
      )}
    </>
  );
}
