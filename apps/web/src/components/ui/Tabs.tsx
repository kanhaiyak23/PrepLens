"use client";

/** Pill tabs with optional counts. Design source: Stitch "My Posts" (My posts / Saved) and "Admin Moderation" (queue tabs). */
export type TabItem<K extends string> = { key: K; label: string; count?: number };

export function Tabs<K extends string>({ items, active, onChange, label }: { items: TabItem<K>[]; active: K; onChange: (k: K) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-1 bg-surface-container rounded-xl p-1">
      {items.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-2 text-sm rounded-lg transition-colors cursor-pointer ${active === t.key ? "bg-surface-container-lowest text-on-surface font-semibold shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-2 text-xs bg-primary text-on-primary rounded-lg px-1.5 py-0.5">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
