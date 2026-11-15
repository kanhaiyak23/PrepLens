import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import type { ExperienceCard as Card, Page } from "@preplens/shared";
import { PageShell } from "@/components/app/PageShell";
import { ExperienceCard } from "@/components/app/ExperienceCard";
import { GuidePanel } from "@/components/app/GuidePanel";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { ServerApiError, serverFetch } from "@/lib/serverApi";

export const metadata: Metadata = { title: "Company · PrepLens" };

export default function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <PageShell width="max-w-6xl">
      <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
        <Body params={params} />
      </Suspense>
    </PageShell>
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
      <p className="text-sm mb-2"><Link href="/archive" className="text-primary font-medium hover:underline">Experiences</Link> <span className="text-on-surface-variant">/ Company</span></p>
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-8">{name}</h1>
      {problem && <Notice kind="error">{problem}</Notice>}
      <div className="clayout">
        <div className="space-y-5">
          {feed && feed.data.length === 0 && <EmptyState title="No experiences yet." action={<ButtonLink href="/submit">Share yours</ButtonLink>}>Nobody has shared an interview for this company yet.</EmptyState>}
          {feed && feed.data.length > 0 && <ul className="grid grid-cols-1 gap-5 p-0 m-0">{feed.data.map((x) => <ExperienceCard key={x.id} x={x} />)}</ul>}
          {feed?.page.hasMore && <ButtonLink variant="secondary" href={`/archive?company=${encodeURIComponent(slug)}`}>See all in the archive</ButtonLink>}
        </div>
        <GuidePanel slug={slug} />
      </div>
    </>
  );
}
