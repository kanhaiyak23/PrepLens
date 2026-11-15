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
      <header className="bg-surface-container-low rounded-2xl p-6 sm:p-8 mb-8">
        <Link href="/archive" className="inline-flex items-center gap-1 text-sm text-primary font-medium mb-5 hover:underline"><Icon name="arrow_back" className="!text-base" />Back to experiences</Link>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
          <div className="space-y-3 min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className="bg-surface-container-lowest rounded-lg px-2 py-1">{DRIVE_LABEL[x.driveType]}</span>
              <span className="bg-surface-container-lowest rounded-lg px-2 py-1">{interviewDate(x.interviewYear, x.interviewMonth)}</span>
              <span className="bg-surface-container-lowest rounded-lg px-2 py-1">Campus: {CAMPUS_LABEL[x.campus]}</span>
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight"><Link href={`/company/${x.company.slug}`} className="text-primary hover:underline">{x.company.name}</Link></h1>
              <Badge tone={OUTCOME_TONE[x.outcome]} dot>{OUTCOME_LABEL[x.outcome]}</Badge>
            </div>
            <p className="text-xl sm:text-2xl font-semibold">{x.role}</p>
            <p className="text-sm text-on-surface-variant">{authorLabel(x.author)} · shared {shortDate(x.createdAt)}{x.updatedAt ? ` · edited ${shortDate(x.updatedAt)}` : ""}</p>
          </div>
          <div className="bg-surface-container-lowest rounded-xl shadow-sm px-5 py-4 flex items-center gap-3 shrink-0">
            <span className="w-10 h-10 rounded-lg bg-primary-fixed text-on-primary-fixed flex items-center justify-center"><Icon name="timer" /></span>
            <div><p className="text-xs uppercase tracking-wide text-on-surface-variant">Total stages</p><p className="text-lg font-bold">{x.rounds.length} {x.rounds.length === 1 ? "round" : "rounds"}</p></div>
          </div>
        </div>
      </header>

      <h2 className="flex items-center gap-2 text-sm font-semibold bg-surface-container-low rounded-xl px-4 py-3 mb-6"><Icon name="timeline" className="text-primary" />Interview walkthrough</h2>
      <ol className="list-none p-0 m-0 space-y-8">
        {x.rounds.map((r) => (
          <li key={r.position} className="grid grid-cols-[2.5rem_1fr] gap-4">
            <span className="w-8 h-8 rounded-[50%] bg-primary text-on-primary text-xs font-bold flex items-center justify-center">{String(r.position).padStart(2, "0")}</span>
            <div className="min-w-0 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Stage {r.position}</p>
                <h3 className="text-xl font-bold">{r.name}</h3>
              </div>
              {r.questions.length > 0 && (
                <ul className="list-none p-0 m-0 space-y-3">
                  {r.questions.map((q, i) => (
                    <li key={i} className="bg-surface-container-low rounded-xl p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm leading-relaxed">{q.text}</p>
                        {q.topic && <span className="text-xs font-medium bg-primary-fixed text-on-primary-fixed rounded-lg px-2 py-0.5">{q.topic}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {r.tips && (
                <p className="flex gap-2 bg-primary-fixed/60 text-on-primary-fixed rounded-xl p-4 text-sm leading-relaxed">
                  <Icon name="tips_and_updates" className="!text-lg shrink-0" /><span><b>{r.questions.length === 0 ? "Notes: " : "Tip: "}</b>{r.tips}</span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
