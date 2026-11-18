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
    feed = await serverFetch<Page<Card>>(`/api/v1/experiences?company=${encodeURIComponent(slug)}&limit=12`, { revalidate: 30 });
  } catch (e) {
    problem = e instanceof ServerApiError ? e.message : "Something went wrong.";
  }
  const name = feed?.data[0]?.company.name ?? slug;
  return (
    <>
      <div className="flex items-center gap-5 mb-10 animate-rise">
        <span aria-hidden="true" className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-3xl bg-gradient-to-br from-maroon to-primary text-white flex items-center justify-center font-display text-4xl font-semibold shadow-lg">{name.charAt(0).toUpperCase()}</span>
        <div className="min-w-0">
          <p className="text-sm mb-1.5"><Link href="/archive" className="text-on-surface-variant font-medium hover:text-primary transition-colors">Experiences</Link> <span className="text-outline">/</span> <span className="text-primary font-semibold">Company</span></p>
          <h1 className="text-4xl sm:text-5xl leading-[1.05] truncate">{name}</h1>
          {feed && feed.data.length > 0 && <p className="text-sm text-on-surface-variant mt-1.5">{feed.data.length}{feed.page.hasMore ? "+" : ""} published {feed.data.length === 1 && !feed.page.hasMore ? "experience" : "experiences"}</p>}
        </div>
      </div>
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
