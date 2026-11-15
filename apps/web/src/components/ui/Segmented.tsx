"use client";

/**
 * A row of exclusive choices drawn as buttons (radio semantics). Generic over the value type so callers keep their enums.
 * Design source: Stitch "Share Your Interview": Drive type (On-campus / Off-campus / Referral) and Outcome
 * (Selected / Rejected / In process / Withdrew) are segmented buttons; the chosen one is filled.
 */
export function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label}>
      <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
            className={`flex-1 min-w-[5.5rem] px-3 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${value === o.value ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
