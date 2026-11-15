import Link from "next/link";
import type { ExperienceCard as Card } from "@preplens/shared";
import { CAMPUS_LABEL, DRIVE_LABEL, OUTCOME_LABEL, OUTCOME_TONE, authorLabel, interviewDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

/**
 * Pure presentation (Single Responsibility): takes one card of data, renders it, knows nothing about fetching.
 * Design source: Stitch "Experiences Archive" card: company + outcome badge + drive tag, role line, date/rounds/helpful meta
 * on the right, author line with initial circle at the bottom, "Read interview breakdown" link.
 * Dropped: the "Questions asked" topic tags row (the list API does not return questions) and author photos.
 */
export function ExperienceCard({ x }: { x: Card }) {
  const who = authorLabel(x.author);
  return (
    <li className="list-none">
      <article className="group relative bg-surface-container-lowest rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-surface-variant/60">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold">
                <Link href={`/experience/${x.id}`} className="hover:text-primary hover:underline after:absolute after:inset-0">{x.company.name}</Link>
              </h2>
              <Badge tone={OUTCOME_TONE[x.outcome]}>{OUTCOME_LABEL[x.outcome]}</Badge>
              <span className="text-xs px-2 py-0.5 rounded-lg bg-surface-container text-on-surface-variant font-medium">{DRIVE_LABEL[x.driveType]}</span>
            </div>
            <p className="text-base font-semibold">{x.role}</p>
          </div>
          <div className="flex md:flex-col md:items-end gap-3 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1 font-medium"><Icon name="calendar_today" className="!text-sm" />{interviewDate(x.interviewYear, x.interviewMonth)} · {x.roundCount} {x.roundCount === 1 ? "round" : "rounds"}</span>
            <span className="inline-flex items-center gap-1 bg-surface-container-low px-2 py-1 rounded-lg text-primary font-semibold"><Icon name="thumb_up" className="!text-sm" />{x.upvoteCount} found this helpful</span>
          </div>
        </div>
        <div className="pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-on-surface-variant">
          <p className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-[50%] bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-[10px]">{who.charAt(0).toUpperCase()}</span>
            <span className="font-medium text-on-surface">{who}</span>
            <span className="text-outline">·</span>
            <span>{CAMPUS_LABEL[x.campus]}</span>
          </p>
          <span className="inline-flex items-center gap-1 text-primary font-semibold">Read interview breakdown<Icon name="chevron_right" className="!text-base" /></span>
        </div>
      </article>
    </li>
  );
}
