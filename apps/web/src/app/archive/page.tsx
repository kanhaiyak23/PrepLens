import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import type { CompanySummary, ExperienceCard as Card, Page } from "@preplens/shared";
import { PageShell } from "@/components/app/PageShell";
import { ExperienceCard } from "@/components/app/ExperienceCard";
import { Filters, type FilterValues } from "@/components/app/Filters";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { OUTCOME_LABEL } from "@/lib/format";
import { ServerApiError, serverFetch } from "@/lib/serverApi";

export const metadata: Metadata = { title: "Experiences · PrepLens", description: "Browse NST placement interview experiences, round by round." };

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const toQuery = (o: Record<string, string | undefined>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]);

/** Design source: Stitch "Experiences Archive": title + description, filter deck, active-filter pills, stack of cards, "Older experiences" button. */
export default function ArchivePage({ searchParams }: { searchParams: Search }) {
  return (
    <PageShell eyebrow="NST placement archive" title="Experiences" description="Real interview rounds, questions and tips from NST students. Pick a company to see what each round asked.">
      <Suspense fallback={<p className="text-on-surface-variant py-6">Loading experiences…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function Results({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const values: FilterValues = { q: one(sp.q), company: one(sp.company), outcome: one(sp.outcome), year: one(sp.year), campus: one(sp.campus), role: one(sp.role), sort: one(sp.sort) };
  const cursor = one(sp.cursor);

  let feed: Page<Card> | null = null;
  let companies: CompanySummary[] = [];
  let problem: string | null = null;
  try {
    [feed, { data: companies }] = await Promise.all([
      serverFetch<Page<Card>>(`/api/v1/experiences?${toQuery({ ...values, cursor, limit: "12" })}`),
      serverFetch<{ data: CompanySummary[] }>("/api/v1/companies?limit=50"),
    ]);
  } catch (e) {
    problem = e instanceof ServerApiError ? e.message : "Something went wrong.";
  }

  // Active filter pills: each one is a link to the same page without that filter (no client state needed).
  const pills: { label: string; remove: FilterValues }[] = [];
  if (values.q) pills.push({ label: `Search: ${values.q}`, remove: { ...values, q: undefined } });
  if (values.company) pills.push({ label: `Company: ${companies.find((c) => c.slug === values.company)?.name ?? values.company}`, remove: { ...values, company: undefined } });
  if (values.outcome) pills.push({ label: `Outcome: ${OUTCOME_LABEL[values.outcome as keyof typeof OUTCOME_LABEL] ?? values.outcome}`, remove: { ...values, outcome: undefined } });
  const hasFilters = Object.values(values).some(Boolean);

  return (
    <div className="space-y-6">
      <Filters values={values} companies={companies} />
      {pills.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mr-1">Active filters</span>
          {pills.map((p) => (
            <Link key={p.label} href={`/archive?${toQuery(p.remove as Record<string, string | undefined>)}`} className="inline-flex items-center gap-1.5 bg-primary-fixed text-on-primary-fixed px-2.5 py-1 rounded-full text-xs font-medium" aria-label={`Remove filter ${p.label}`}>
              {p.label}<Icon name="close" className="!text-sm" />
            </Link>
          ))}
        </div>
      )}
      {problem && <Notice kind="error">{problem}</Notice>}
      {feed && feed.data.length === 0 && !cursor && (
        <EmptyState title={hasFilters ? "No experiences match these filters." : "No experiences yet. Be the first to share one."} action={<ButtonLink href="/submit"><Icon name="add_circle" className="!text-lg" />Share your interview</ButtonLink>}>
          {hasFilters ? "Try removing a filter, or share your own interview." : "Your interview journey helps peers prepare better. Share the rounds, the questions and what you would tell a junior."}
        </EmptyState>
      )}
      {feed && feed.data.length > 0 && (
        <>
          <ul className="grid grid-cols-1 gap-5 p-0 m-0">{feed.data.map((x) => <ExperienceCard key={x.id} x={x} />)}</ul>
          <nav className="flex justify-center gap-3 pt-4" aria-label="Pages">
            {cursor && <ButtonLink variant="secondary" href={`/archive?${toQuery({ ...values })}`}>Back to newest</ButtonLink>}
            {feed.page.hasMore && <ButtonLink variant="secondary" href={`/archive?${toQuery({ ...values, cursor: feed.page.nextCursor ?? undefined })}`}>Older experiences<Icon name="expand_more" className="!text-lg" /></ButtonLink>}
          </nav>
        </>
      )}
    </div>
  );
}
