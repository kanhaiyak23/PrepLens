/**
 * One badge for outcomes, review status and drive type. Colour comes from a tone lookup (Open/Closed).
 * Design source: Stitch "Experiences Archive" (Selected = emerald, In process = blue, Rejected = red, Withdrew = gray)
 * and "My Posts" (Published = green, Waiting for review = amber, Not approved = red, Withdrawn = gray).
 */

// open closed principle
export type Tone = "success" | "info" | "danger" | "neutral" | "warning" | "primary";
const TONE: Record<Tone, string> = {
  success: "text-emerald-800 bg-emerald-50 ring-emerald-600/15",
  info: "text-sky-800 bg-sky-50 ring-sky-600/15",
  danger: "text-red-800 bg-red-50 ring-red-600/15",
  neutral: "text-stone-700 bg-stone-100 ring-stone-500/15",
  warning: "text-amber-800 bg-amber-50 ring-amber-600/20",
  primary: "text-on-primary-fixed bg-primary-fixed ring-primary/15",
};

export function Badge({ tone = "neutral", dot = false, children }: { tone?: Tone; dot?: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset ${TONE[tone]}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-[50%] bg-current" />}
      {children}
    </span>
  );
}
