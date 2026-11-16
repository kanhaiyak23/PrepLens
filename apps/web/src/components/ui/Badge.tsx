/**
 * One badge for outcomes, review status and drive type. Colour comes from a tone lookup (Open/Closed).
 * Design source: Stitch "Experiences Archive" (Selected = emerald, In process = blue, Rejected = red, Withdrew = gray)
 * and "My Posts" (Published = green, Waiting for review = amber, Not approved = red, Withdrawn = gray).
 */

// open closed principle
export type Tone = "success" | "info" | "danger" | "neutral" | "warning" | "primary";
const TONE: Record<Tone, string> = {
  success: "text-emerald-800 bg-emerald-50",
  info: "text-blue-800 bg-blue-50",
  danger: "text-red-800 bg-red-50",
  neutral: "text-gray-700 bg-gray-100",
  warning: "text-amber-800 bg-amber-50",
  primary: "text-on-primary-fixed bg-primary-fixed",
};

export function Badge({ tone = "neutral", dot = false, children }: { tone?: Tone; dot?: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-lg ${TONE[tone]}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-[50%] bg-current" />}
      {children}
    </span>
  );
}
