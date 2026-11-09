import type { Campus, DriveType, ExperienceStatus, Outcome, PublicAuthor } from "@preplens/shared";

export const OUTCOME_LABEL: Record<Outcome, string> = { selected: "Selected", rejected: "Rejected", "in-process": "In process", withdrew: "Withdrew" };
export const OUTCOME_CLASS: Record<Outcome, string> = { selected: "good", rejected: "bad", "in-process": "blue", withdrew: "idle" };
export const DRIVE_LABEL: Record<DriveType, string> = { "on-campus": "On-campus", "off-campus": "Off-campus", referral: "Referral" };
export const CAMPUS_LABEL: Record<Campus, string> = { ru: "RU", bangalore: "Bangalore", hyderabad: "Hyderabad", pune: "Pune" };
export const STATUS_LABEL: Record<ExperienceStatus, string> = { pending: "Waiting for review", published: "Published", rejected: "Not approved", unpublished: "Withdrawn", removed: "Removed" };
export const STATUS_CLASS: Record<ExperienceStatus, string> = { pending: "blue", published: "good", rejected: "bad", unpublished: "idle", removed: "bad" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const interviewDate = (year: number, month: number | null) => (month ? `${MONTHS[month - 1]} ${year}` : String(year));

/** Anonymous authors show the batch only (ADR-06). The API never sends more, so there is nothing to hide here. */
export function authorLabel(a: PublicAuthor): string {
  if (a.anonymous) return `Anonymous${a.batch ? ` · ${a.batch}` : ""}`;
  return [a.name ?? "Student", a.batch, a.branch].filter(Boolean).join(" · ");
}

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
