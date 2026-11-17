import Link from "next/link";
import type { ExperienceDetail } from "@preplens/shared";
import { CAMPUS_LABEL, DRIVE_LABEL, OUTCOME_LABEL, OUTCOME_TONE, authorLabel, interviewDate, shortDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

/**
 * Pure presentation: rounds in order, questions with topics, tips. Used by the server page and by the owner's client view.
 * Design source: Stitch "Amazon SDE Experience Detail": lilac header band (drive/date/campus tags, company + outcome badge,
 * role, author line, "Total stages" tile), then a numbered timeline where each round shows STAGE n, the round name,
 * question cards with topic tags and a lilac "Candidate insight" box for the tip.
 * Dropped: "Difficulty", per-round platform and duration, "Verified by NST Admin" chip (no such data); published posts are
 * admin-reviewed by definition, so the page does not need to say it again.
 */
export function ExperienceView({ x }: { x: ExperienceDetail }) {
  return (
    <article className="min-w-0">
      <header className="relative overflow-hidden bg-surface-container-lowest border border-outline-variant/80 shadow-md rounded-3xl p-6 sm:p-9 mb-10 animate-rise">
        <div aria-hidden="true" className="brand-stripe absolute inset-x-0 top-0" />
        <div aria-hidden="true" className="absolute -top-28 -right-20 w-80 h-80 rounded-full bg-[radial-gradient(closest-side,rgb(200_7_47/0.08),transparent)]" />
        <Link href="/archive" className="relative inline-flex items-center gap-1 text-sm text-on-surface-variant font-medium mb-6 hover:text-primary transition-colors"><Icon name="arrow_back" className="!text-base" />Back to experiences</Link>
        <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="space-y-3 min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className="bg-surface-container-low border border-outline-variant/70 rounded-full px-3 py-1">{DRIVE_LABEL[x.driveType]}</span>
              <span className="bg-surface-container-low border border-outline-variant/70 rounded-full px-3 py-1">{interviewDate(x.interviewYear, x.interviewMonth)}</span>
              <span className="bg-surface-container-low border border-outline-variant/70 rounded-full px-3 py-1">Campus: {CAMPUS_LABEL[x.campus]}</span>
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl sm:text-5xl leading-[1.05]"><Link href={`/company/${x.company.slug}`} className="text-on-surface hover:text-primary transition-colors">{x.company.name}</Link></h1>
              <Badge tone={OUTCOME_TONE[x.outcome]} dot>{OUTCOME_LABEL[x.outcome]}</Badge>
            </div>
            <p className="text-lg sm:text-xl font-semibold text-on-surface-variant">{x.role}</p>
            <p className="text-sm text-on-surface-variant">{authorLabel(x.author)} · shared {shortDate(x.createdAt)}{x.updatedAt ? ` · edited ${shortDate(x.updatedAt)}` : ""}</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-maroon to-primary text-white px-6 py-5 flex items-center gap-4 shrink-0 shadow-lg">
            <span className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center"><Icon name="layers" /></span>
            <div><p className="text-[11px] uppercase tracking-[0.14em] text-white/75">Total stages</p><p className="font-display text-2xl leading-tight">{x.rounds.length} {x.rounds.length === 1 ? "round" : "rounds"}</p></div>
          </div>
        </div>
      </header>

      <div className="flex items-center gap-4 mb-8"><p className="eyebrow-rule text-primary shrink-0">Interview walkthrough</p><span className="h-px flex-1 bg-outline-variant" aria-hidden="true" /></div>
      <ol className="relative list-none p-0 m-0 space-y-10 before:absolute before:left-[1.1875rem] before:top-3 before:bottom-3 before:w-px before:bg-gradient-to-b before:from-primary/50 before:via-outline-variant before:to-transparent">
        {x.rounds.map((r) => (
          <li key={r.position} className="relative grid grid-cols-[2.5rem_1fr] gap-4 sm:gap-5">
            <span className="relative z-10 w-10 h-10 rounded-full bg-primary text-on-primary text-sm font-bold flex items-center justify-center ring-4 ring-background shadow-md">{String(r.position).padStart(2, "0")}</span>
            <div className="min-w-0 space-y-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary pt-1">Stage {r.position}</p>
                <h3 className="font-display text-2xl sm:text-[1.75rem] font-semibold leading-tight">{r.name}</h3>
              </div>
              {r.questions.length > 0 && (
                <ul className="list-none p-0 m-0 space-y-3">
                  {r.questions.map((q, i) => (
                    <li key={i} className="bg-surface-container-lowest border border-outline-variant/80 rounded-2xl p-4 sm:p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-[15px] leading-relaxed min-w-0 flex gap-2.5"><Icon name="help" className="!text-lg text-primary/70 shrink-0 mt-0.5" /><span>{q.text}</span></p>
                        {q.topic && <span className="text-xs font-semibold bg-primary-fixed text-on-primary-fixed ring-1 ring-inset ring-primary/15 rounded-full px-2.5 py-0.5">{q.topic}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {r.tips && (
                <p className="flex gap-3 bg-tertiary-fixed/70 border-l-[3px] border-tertiary-container text-on-surface rounded-r-2xl p-4 sm:p-5 text-sm leading-relaxed">
                  <Icon name="tips_and_updates" className="!text-xl shrink-0 text-tertiary" /><span><b>{r.questions.length === 0 ? "Notes: " : "Tip: "}</b>{r.tips}</span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
