import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import type { ExperienceCard as Card, Page } from "@preplens/shared";
import { AppHeader } from "@/components/app/AppHeader";
import { ExperienceCard } from "@/components/app/ExperienceCard";
import { GuidePanel } from "@/components/app/GuidePanel";
import { ServerApiError, serverFetch } from "@/lib/serverApi";

export const metadata: Metadata = { title: "Company · PrepLens" };

export default function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <>
      <AppHeader />
      <main id="top" className="app-page on-paper">
        <div className="wrap">
          <Suspense fallback={<p className="empty">Loading…</p>}>
            <Body params={params} />
          </Suspense>
        </div>
      </main>
    </>
  );
}

async function Body({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let feed: Page<Card> | null = null;
  let problem: string | null = null;
  try {
    feed = await serverFetch<Page<Card>>(`/api/v1/experiences?company=${encodeURIComponent(slug)}&limit=12`);
  } catch (e) {
    problem = e instanceof ServerApiError ? e.message : "Something went wrong.";
  }
  const name = feed?.data[0]?.company.name ?? slug;
  return (
    <>
      <p className="mono eyebrow"><Link href="/archive">Archive</Link> / Company</p>
      <h1 className="display page-title">{name}</h1>
      {problem && <p role="alert" className="auth-error">{problem}</p>}
      <div className="clayout">
        <div>
          {feed && feed.data.length === 0 && <div className="empty-state"><h2>No experiences yet.</h2><p>Nobody has shared an interview for this company yet.</p><Link className="btn btn-primary" href="/submit">Share yours</Link></div>}
          {feed && feed.data.length > 0 && <ul className="xgrid one">{feed.data.map((x) => <ExperienceCard key={x.id} x={x} />)}</ul>}
          {feed?.page.hasMore && <nav className="pager"><Link className="btn btn-ghost" href={`/archive?company=${encodeURIComponent(slug)}`}>See all in the archive</Link></nav>}
        </div>
        <GuidePanel slug={slug} />
      </div>
    </>
  );
}
