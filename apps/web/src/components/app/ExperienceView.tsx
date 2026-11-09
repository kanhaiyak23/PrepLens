import Link from "next/link";
import type { ExperienceDetail } from "@preplens/shared";
import { CAMPUS_LABEL, DRIVE_LABEL, OUTCOME_CLASS, OUTCOME_LABEL, authorLabel, interviewDate, shortDate } from "@/lib/format";

/** Pure presentation: rounds in order, questions with topics, tips. Used by the server page and the owner's client view. */
export function ExperienceView({ x }: { x: ExperienceDetail }) {
  return (
    <article className="xview">
      <header className="xview-head">
        <p className="mono eyebrow">
          <Link href={`/company/${x.company.slug}`}>{x.company.name}</Link> · {x.role}
        </p>
        <h1 className="display">{x.company.name}</h1>
        <div className="xview-chips">
          <span className={`chip ${OUTCOME_CLASS[x.outcome]}`}>{OUTCOME_LABEL[x.outcome]}</span>
          <span className="tagline">{DRIVE_LABEL[x.driveType]}</span>
          <span className="tagline">{interviewDate(x.interviewYear, x.interviewMonth)}</span>
          <span className="tagline">Campus: {CAMPUS_LABEL[x.campus]}</span>
        </div>
        <p className="xview-author">
          {authorLabel(x.author)}
          <span> · shared {shortDate(x.createdAt)}{x.updatedAt ? ` · edited ${shortDate(x.updatedAt)}` : ""}</span>
        </p>
      </header>
      <ol className="rounds-list">
        {x.rounds.map((r) => (
          <li key={r.position} className="rcard">
            <div className="rno">{String(r.position).padStart(2, "0")}</div>
            <div className="rbody">
              <h2>{r.name}</h2>
              {r.questions.length > 0 && (
                <ul className="qlist">
                  {r.questions.map((q, i) => (
                    <li key={i}>
                      {q.text}
                      {q.topic && <span className="topic">{q.topic}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {r.tips && <p className="rtips"><b className="mono">{r.questions.length === 0 ? "Notes" : "Tip"}</b>{r.tips}</p>}
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
