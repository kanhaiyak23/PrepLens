import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/**
 * Single Responsibility: the card every admin list uses (queue, edits, reports, companies), so spacing is decided once.
 * Left: what the item is (title, badges, meta, any inline form). Right: what the admin can do. Stacks on a phone.
 * Design source: Stitch "Admin Moderation" queue card (company + role, outcome badge, meta line, Approve / Reject buttons).
 */
export function AdminRow({ title, href, subtitle, badges, meta, danger = false, actions, children }: {
  title: string; href?: string; subtitle?: string; badges?: React.ReactNode; meta?: React.ReactNode[]; danger?: boolean; actions?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <li className={`list-none bg-surface-container-lowest border border-surface-variant rounded-xl p-5 sm:p-6 flex flex-col md:flex-row md:items-start justify-between gap-5 ${danger ? "border-l-4 !border-l-error" : ""}`}>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="text-lg font-bold">{href ? <Link href={href} className="hover:text-primary hover:underline">{title}</Link> : title}</h3>
          {subtitle && <span className="text-sm text-on-surface-variant">{subtitle}</span>}
        </div>
        {badges && <div className="flex flex-wrap items-center gap-2">{badges}</div>}
        {meta && meta.length > 0 && <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">{meta.map((m, i) => <span key={i}>{m}</span>)}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 md:justify-end shrink-0">{actions}</div>}
    </li>
  );
}

/** Heading and one-line hint for an admin panel, with the content spaced below. */
export function AdminSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        {hint && <p className="text-sm text-on-surface-variant mt-1">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function AdminEmpty({ icon = "task_alt", children }: { icon?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 bg-surface-container-low rounded-xl px-5 py-6 text-sm text-on-surface-variant">
      <Icon name={icon} className="text-primary" />{children}
    </div>
  );
}

/** The "reason shown to the author" form used when rejecting. */
export function RejectForm({ note, onNote, busy, onSubmit, onCancel }: { note: string; onNote: (v: string) => void; busy: boolean; onSubmit: () => void; onCancel: () => void }) {
  return (
    <form className="grid gap-3 bg-surface-container-low rounded-xl p-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <label><span>Reason shown to the author</span><input required value={note} maxLength={1000} onChange={(e) => onNote(e.target.value)} placeholder="What needs to change?" /></label>
      <div className="flex gap-2">
        <button className="btn btn-primary small" disabled={busy}>Send rejection</button>
        <button type="button" className="btn btn-ghost small" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
