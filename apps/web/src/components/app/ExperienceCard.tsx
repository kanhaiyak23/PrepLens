import Link from "next/link";
import type { ExperienceCard as Card } from "@preplens/shared";
import { CAMPUS_LABEL, DRIVE_LABEL, OUTCOME_LABEL, OUTCOME_TONE, authorLabel, interviewDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

/**
 * Pure presentation (Single Responsibility): takes one card of data, renders it, knows nothing about fetching.
 * Design source: Rishihood brand (ADR-29): white card with a company monogram, outcome badge, role, a meta row
 * (drive, date, rounds), the author line, and a crimson edge that slides in on hover. The whole card is the link.
 */
export function ExperienceCard({ x }: { x: Card }) {
  const who = authorLabel(x.author);
  return (
    <li className="list-none">
      <article className="group relative overflow-hidden bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-outline-variant/80 shadow-sm transition-all hover:shadow-lg hover:border-primary/30">
        <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-tertiary-container scale-y-0 group-hover:scale-y-100 origin-top transition-transform duration-300" />
        <div className="flex gap-4 sm:gap-5">
          <span aria-hidden="true" className="hidden sm:flex w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-primary-fixed to-secondary-container text-on-primary-fixed items-center justify-center font-display text-2xl font-semibold">
            {x.company.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-xl font-bold tracking-tight">
                    <Link href={`/experience/${x.id}`} className="group-hover:text-primary transition-colors after:absolute after:inset-0">{x.company.name}</Link>
                  </h2>
                  <Badge tone={OUTCOME_TONE[x.outcome]} dot>{OUTCOME_LABEL[x.outcome]}</Badge>
                </div>
                <p className="text-[15px] font-medium text-on-surface-variant">{x.role}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-surface-container-low border border-outline-variant/70 px-3 py-1 text-xs font-semibold text-on-surface">
                <Icon name="thumb_up" className="!text-sm text-primary" />{x.upvoteCount} <span className="font-normal text-on-surface-variant">found this helpful</span>
              </span>
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5"><Icon name="work" className="!text-[15px]" />{DRIVE_LABEL[x.driveType]}</span>
              <span className="inline-flex items-center gap-1.5"><Icon name="calendar_today" className="!text-[15px]" />{interviewDate(x.interviewYear, x.interviewMonth)}</span>
              <span className="inline-flex items-center gap-1.5"><Icon name="layers" className="!text-[15px]" />{x.roundCount} {x.roundCount === 1 ? "round" : "rounds"}</span>
              <span className="inline-flex items-center gap-1.5"><Icon name="location_on" className="!text-[15px]" />{CAMPUS_LABEL[x.campus]}</span>
            </p>
            <div className="mt-5 pt-4 border-t border-surface-variant flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <p className="flex items-center gap-2 min-w-0">
                <span className="w-6 h-6 shrink-0 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-[10px]">{who.charAt(0).toUpperCase()}</span>
                <span className="font-medium text-on-surface truncate">{who}</span>
              </p>
              <span className="inline-flex items-center gap-1 text-primary font-semibold">Read the breakdown<Icon name="arrow_forward" className="!text-base transition-transform group-hover:translate-x-0.5" /></span>
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}
