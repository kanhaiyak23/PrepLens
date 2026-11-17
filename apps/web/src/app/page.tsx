import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import type { CompanySummary, ExperienceCard as Card, Page } from "@preplens/shared";
import { AppHeader } from "@/components/app/AppHeader";
import { AppFooter } from "@/components/app/AppFooter";
import { NstLogo, RishihoodLogo } from "@/components/brand/Brand";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { DRIVE_LABEL, OUTCOME_LABEL, OUTCOME_TONE, authorLabel, interviewDate } from "@/lib/format";
import { serverFetch } from "@/lib/serverApi";

/**
 * Design source: Rishihood brand (ADR-29). Campus hero, brand strip, live archive (real counts and the latest posts from the API,
 * never invented numbers), how it works, a campus image band, the four promises, and a closing call to share.
 */
const STEPS = [
  { n: "01", title: "Find the company", body: "Search by company, role or topic and open the rounds a senior actually sat." },
  { n: "02", title: "Read round by round", body: "Every round in order: what was asked, the topic it tested, and the tip they wish they had." },
  { n: "03", title: "Pay it forward", body: "After your own interview, write it down. An admin reviews it, then the next batch reads it." },
];

const PROMISES = [
  { icon: "verified_user", title: "NST accounts only", body: "Posting needs a verified @nst.rishihood.edu.in account, checked by the server, so every post is from a real student." },
  { icon: "visibility_off", title: "Anonymous when you want", body: "Post anonymously and readers see only your batch. Your name never leaves the server." },
  { icon: "fact_check", title: "Reviewed before public", body: "An admin reads every post before it goes live, and every moderation decision is logged." },
  { icon: "undo", title: "Yours to withdraw", body: "Unpublish your post instantly, any time. Edits to a live post are reviewed before they replace it." },
];

export default function Home() {
  return (
    <>
      <AppHeader />
      <main className="w-full">
        <Hero />
        <BrandStrip />
        <Suspense fallback={<LiveSkeleton />}>
          <LiveArchive />
        </Suspense>
        <HowItWorks />
        <ImageBand />
        <Promises />
        <ClosingCta />
      </main>
      <AppFooter />
    </>
  );
}

function Hero() {
  return (
    <section className="relative isolate min-h-[640px] h-[min(92vh,820px)] flex items-end overflow-hidden bg-maroon-deep">
      <Image src="/brand/campus.webp" alt="The Rishihood University campus in Sonipat" fill sizes="100vw" loading="eager" fetchPriority="high" className="object-cover object-[70%_center] -z-20 scale-[1.02]" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgb(43_7_16/0.96)_0%,rgb(74_10_26/0.88)_38%,rgb(74_10_26/0.45)_68%,rgb(43_7_16/0.25)_100%)]" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-40 -z-10 bg-gradient-to-t from-maroon-deep/80 to-transparent" />
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 sm:pb-24">
        <div className="max-w-3xl text-white animate-rise">
          <p className="eyebrow-rule text-gold mb-6">Newton School of Technology · Rishihood University</p>
          <h1 className="text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-7xl text-white">
            Walk into every interview <em className="italic text-[#ffb3c0]">knowing</em> what it asks.
          </h1>
          <p className="mt-6 text-base sm:text-lg text-white/80 leading-relaxed max-w-2xl">
            Real placement interviews, written round by round by NST seniors who sat in them. The questions, the topics, and what they would tell you before you go in.
          </p>
          <form action="/archive" role="search" className="mt-9 flex w-full max-w-xl items-center gap-2 rounded-full bg-white p-1.5 pl-5 shadow-lg ring-1 ring-black/5">
            <Icon name="search" className="text-on-surface-variant" />
            <label className="flex-1 min-w-0">
              <span className="sr-only">Search experiences</span>
              <input name="q" type="search" autoComplete="off" placeholder="Search a company or topic" className="!bg-transparent !border-0 !px-1 !py-2.5 !text-[15px] !text-on-surface placeholder:text-on-surface-variant/70 focus:!bg-transparent" />
            </label>
            <button type="submit" className="shrink-0 rounded-full bg-primary hover:bg-primary-container text-white text-sm font-semibold px-5 sm:px-6 py-3 transition-colors cursor-pointer">Search</button>
          </form>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <Link href="/archive" className="group inline-flex items-center gap-1.5 font-semibold text-white hover:text-[#ffb3c0] transition-colors">Browse all experiences<Icon name="arrow_forward" className="!text-lg transition-transform group-hover:translate-x-0.5" /></Link>
            <Link href="/submit" className="group inline-flex items-center gap-1.5 font-semibold text-white/80 hover:text-white transition-colors"><Icon name="edit_note" className="!text-lg" />Share your interview</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function BrandStrip() {
  return (
    <section className="border-b border-outline-variant/70 bg-surface-container-lowest">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 flex flex-col md:flex-row items-center justify-between gap-6">
        <p className="text-xs font-semibold tracking-[0.16em] uppercase text-on-surface-variant text-center md:text-left">Made by students, for the students of</p>
        <div className="flex items-center gap-8 sm:gap-12">
          <NstLogo className="h-8 sm:h-9 w-auto opacity-80" />
          <span className="h-9 w-px bg-outline-variant" aria-hidden="true" />
          <RishihoodLogo className="h-9 sm:h-10 w-auto" />
        </div>
      </div>
    </section>
  );
}

/* ---------- Live archive: every number here is computed from the API response ---------- */

async function loadLive() {
  try {
    const [feed, companies] = await Promise.all([
      serverFetch<Page<Card>>("/api/v1/experiences?limit=3"),
      serverFetch<{ data: CompanySummary[] }>("/api/v1/companies?limit=50"),
    ]);
    return { feed: feed.data, companies: companies.data };
  } catch {
    return null;
  }
}

async function LiveArchive() {
  const live = await loadLive();
  if (!live) return null; // the archive is unreachable: the rest of the page still explains the product
  const withPosts = live.companies.filter((c) => c.experienceCount > 0).sort((a, b) => b.experienceCount - a.experienceCount);
  const total = withPosts.reduce((n, c) => n + c.experienceCount, 0);

  return (
    <section className="bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end mb-12">
          <div className="lg:col-span-7 space-y-4">
            <p className="eyebrow-rule text-primary">Live from the archive</p>
            <h2 className="font-display text-4xl sm:text-5xl leading-[1.05]">Fresh from the interview room.</h2>
            <p className="text-on-surface-variant max-w-xl leading-relaxed">The latest experiences shared by NST students, each one reviewed before it went public.</p>
          </div>
          {total > 0 && (
            <dl className="lg:col-span-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-outline-variant bg-outline-variant">
              <Stat label={total === 1 ? "Experience published" : "Experiences published"} value={total} />
              <Stat label={withPosts.length === 1 ? "Company covered" : "Companies covered"} value={withPosts.length} />
            </dl>
          )}
        </div>

        {live.feed.length > 0 ? (
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 p-0 m-0 list-none">
            {live.feed.map((x) => <Tile key={x.id} x={x} />)}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-10 text-center">
            <p className="font-display text-2xl mb-2">The archive is waiting for its first story.</p>
            <p className="text-on-surface-variant mb-6">Interviewed recently? Your notes are the next batch&apos;s head start.</p>
            <ButtonLink href="/submit">Share your interview</ButtonLink>
          </div>
        )}

        {withPosts.length > 0 && (
          <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <ul className="flex flex-wrap gap-2 p-0 m-0 list-none" aria-label="Companies in the archive">
              {withPosts.slice(0, 10).map((c) => (
                <li key={c.slug}>
                  <Link href={`/company/${c.slug}`} className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium hover:border-primary/50 hover:text-primary transition-colors">
                    {c.name}<span className="text-xs text-on-surface-variant">{c.experienceCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/archive" className="group shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">View the full archive<Icon name="arrow_forward" className="!text-lg transition-transform group-hover:translate-x-0.5" /></Link>
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface-container-lowest px-6 py-5">
      <dt className="text-xs font-medium text-on-surface-variant">{label}</dt>
      <dd className="font-display text-5xl leading-none mt-2 text-on-surface">{value}</dd>
    </div>
  );
}

function Tile({ x }: { x: Card }) {
  return (
    <li>
      <article className="group relative h-full flex flex-col rounded-2xl border border-outline-variant/80 bg-surface-container-lowest p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/30">
        <div className="flex items-start justify-between gap-3 mb-5">
          <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-fixed to-secondary-container text-on-primary-fixed flex items-center justify-center font-display text-xl font-semibold">{x.company.name.charAt(0).toUpperCase()}</span>
          <Badge tone={OUTCOME_TONE[x.outcome]} dot>{OUTCOME_LABEL[x.outcome]}</Badge>
        </div>
        <h3 className="text-lg font-bold leading-snug">
          <Link href={`/experience/${x.id}`} className="after:absolute after:inset-0 group-hover:text-primary transition-colors">{x.company.name}</Link>
        </h3>
        <p className="text-sm text-on-surface-variant mt-1">{x.role}</p>
        <p className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-on-surface-variant">
          <span>{DRIVE_LABEL[x.driveType]}</span><span aria-hidden="true">·</span>
          <span>{interviewDate(x.interviewYear, x.interviewMonth)}</span><span aria-hidden="true">·</span>
          <span>{x.roundCount} {x.roundCount === 1 ? "round" : "rounds"}</span>
        </p>
        <div className="mt-auto pt-5 flex items-center justify-between border-t border-surface-variant text-xs">
          <span className="font-medium text-on-surface truncate">{authorLabel(x.author)}</span>
          <span className="inline-flex items-center gap-1 text-on-surface-variant shrink-0"><Icon name="thumb_up" className="!text-sm" />{x.upvoteCount}</span>
        </div>
      </article>
    </li>
  );
}

function LiveSkeleton() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24" aria-busy="true" aria-label="Loading the latest experiences">
      <div className="h-4 w-40 rounded bg-surface-container mb-5" />
      <div className="h-10 w-full max-w-md rounded bg-surface-container mb-12" />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-56 rounded-2xl bg-surface-container-low animate-pulse" />)}</div>
    </section>
  );
}

/* ---------- Static story sections ---------- */

function HowItWorks() {
  return (
    <section className="bg-surface-container-lowest border-y border-outline-variant/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 grid gap-14 lg:grid-cols-2 lg:items-center">
        <div className="relative">
          <div className="relative aspect-[4/3.4] overflow-hidden rounded-3xl shadow-lg">
            <Image src="/brand/presentation.webp" alt="A Rishihood student presenting to a classroom" fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
          </div>
          <div className="absolute -bottom-6 -right-2 sm:-right-6 max-w-[16rem] rounded-2xl bg-maroon text-white p-5 shadow-lg">
            <Icon name="format_quote" className="!text-3xl text-gold" />
            <p className="font-display text-lg leading-snug mt-1">Nine days to the interview. Here is what each round asks.</p>
          </div>
        </div>
        <div>
          <p className="eyebrow-rule text-primary mb-4">How it works</p>
          <h2 className="font-display text-4xl sm:text-5xl leading-[1.05] mb-10">From one senior&apos;s notes to the whole batch&apos;s head start.</h2>
          <ol className="space-y-8 p-0 m-0 list-none">
            {STEPS.map((s) => (
              <li key={s.n} className="grid grid-cols-[3.5rem_1fr] gap-4">
                <span className="font-display italic text-4xl text-primary leading-none">{s.n}</span>
                <div className="border-b border-surface-variant pb-7">
                  <h3 className="text-lg font-bold mb-1.5">{s.title}</h3>
                  <p className="text-on-surface-variant leading-relaxed">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function ImageBand() {
  return (
    <section className="relative isolate overflow-hidden bg-maroon-deep">
      <Image src="/brand/students.webp" alt="Rishihood University students together on campus" fill sizes="100vw" className="object-cover -z-20" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(43_7_16/0.78),rgb(74_10_26/0.88))]" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 text-center text-white">
        <p className="eyebrow-rule text-gold justify-center mb-6">Seniors to juniors</p>
        <p className="font-display text-3xl sm:text-5xl leading-[1.15]">
          Written by seniors who sat in the room, <em className="italic text-[#ffb3c0]">for juniors who are about to.</em>
        </p>
      </div>
    </section>
  );
}

function Promises() {
  return (
    <section className="bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <div className="max-w-2xl mb-14">
          <p className="eyebrow-rule text-primary mb-4">Built on trust</p>
          <h2 className="font-display text-4xl sm:text-5xl leading-[1.05]">Honest stories need a safe place to live.</h2>
        </div>
        <ul className="grid gap-px overflow-hidden rounded-3xl border border-outline-variant bg-outline-variant sm:grid-cols-2 lg:grid-cols-4 p-0 m-0 list-none">
          {PROMISES.map((p) => (
            <li key={p.title} className="bg-surface-container-lowest p-7 sm:p-8">
              <span className="w-12 h-12 rounded-2xl bg-primary-fixed text-primary flex items-center justify-center mb-6"><Icon name={p.icon} className="!text-2xl" /></span>
              <h3 className="text-base font-bold mb-2">{p.title}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">{p.body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-3xl bg-surface-container-low border border-outline-variant p-7 sm:p-8 flex flex-col md:flex-row md:items-center gap-6 justify-between">
          <div className="flex items-start gap-4">
            <span className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-tertiary-container to-primary text-white flex items-center justify-center"><Icon name="auto_awesome" className="!text-2xl" /></span>
            <div>
              <h3 className="text-base font-bold mb-1">Company prep guides that show their sources</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed max-w-2xl">Once a company has enough experiences, an AI summary of its rounds appears on the company page. Every point cites the posts it came from, and every count is calculated from the posts, never generated.</p>
            </div>
          </div>
          <ButtonLink href="/archive" variant="secondary" className="shrink-0">Explore companies</ButtonLink>
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(120deg,#9e0626_0%,#c8072f_45%,#d7815d_100%)] px-6 py-16 sm:px-14 sm:py-20 text-white shadow-lg">
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-4 -right-8 w-[min(720px,95%)] -z-10 opacity-20">
          <Image src="/brand/campus-line.webp" alt="" width={1024} height={342} className="w-full h-auto" />
        </div>
        <div className="max-w-2xl">
          <h2 className="font-display text-4xl sm:text-5xl leading-[1.05]">Sat an interview recently?</h2>
          <p className="mt-4 text-white/85 text-lg leading-relaxed">Your notes are somebody&apos;s head start. It takes about ten minutes, and you can stay anonymous.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link href="/submit" className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-primary font-semibold px-7 py-3.5 hover:bg-primary-fixed transition-colors">Share your interview<Icon name="arrow_forward" className="!text-lg" /></Link>
            <Link href="/archive" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/50 text-white font-semibold px-7 py-3.5 hover:bg-white/10 transition-colors">Read the archive</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
