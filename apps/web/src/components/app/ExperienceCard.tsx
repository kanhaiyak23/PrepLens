import Link from "next/link";
import type { ExperienceCard as Card } from "@preplens/shared";
import { CAMPUS_LABEL, DRIVE_LABEL, OUTCOME_CLASS, OUTCOME_LABEL, authorLabel, interviewDate } from "@/lib/format";

export function ExperienceCard({ x }: { x: Card }) {
  return (
    <li className="xcard">
      <Link href={`/experience/${x.id}`} className="xcard-link">
        <div className="xcard-top">
          <h2>{x.company.name}</h2>
          <span className={`chip ${OUTCOME_CLASS[x.outcome]}`}>{OUTCOME_LABEL[x.outcome]}</span>
        </div>
        <p className="xcard-role">
          {x.role} · {DRIVE_LABEL[x.driveType]}
        </p>
        <p className="xcard-meta">
          <span>{interviewDate(x.interviewYear, x.interviewMonth)}</span>
          <span>{x.roundCount} {x.roundCount === 1 ? "round" : "rounds"}</span>
          <span>{CAMPUS_LABEL[x.campus]}</span>
          <span>{x.upvoteCount} helpful</span>
        </p>
        <p className="xcard-author">{authorLabel(x.author)}</p>
      </Link>
    </li>
  );
}
