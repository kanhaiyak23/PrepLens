"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OUTCOMES, type CompanySummary } from "@preplens/shared";
import { OUTCOME_LABEL } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export type FilterValues = { q?: string; company?: string; outcome?: string; year?: string; campus?: string; role?: string; sort?: string };

/**
 * Filters live in the URL, so a filtered list can be shared, bookmarked and reloaded (deep links).
 * Design source: Stitch "Experiences Archive" filter deck: search with icon (5 cols), company select (3), outcome select (2),
 * Search + Clear (2), all on one white rounded card. Year, campus, role and sort stay supported by the API but are not shown (keep it simple).
 */
const field = "w-full appearance-none bg-surface-container-low text-on-surface text-sm rounded-xl border border-outline-variant/70 px-3.5 py-2.5 focus:outline-none focus:border-primary focus:bg-surface-container-lowest font-medium";

export function Filters({ values, companies }: { values: FilterValues; companies: CompanySummary[] }) {
  const router = useRouter();
  const [v, setV] = useState<FilterValues>(values);

  function apply(next: FilterValues) {
    const p = new URLSearchParams();
    Object.entries(next).forEach(([k, val]) => val && p.set(k, val));
    router.push(`/archive${p.size ? `?${p}` : ""}`);
  }
  const set = (k: keyof FilterValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const next = { ...v, [k]: e.target.value };
    setV(next);
    if (k !== "q") apply(next);
  };

  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); apply(v); }} className="relative -mt-16 sm:-mt-20 z-10 bg-surface-container-lowest rounded-2xl p-3 sm:p-4 shadow-lg border border-outline-variant/70 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
      <label className="md:col-span-4 relative flex items-center">
        <span className="sr-only">Search questions and topics</span>
        <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input id="q" type="search" autoComplete="off" value={v.q ?? ""} onChange={set("q")} placeholder="Search questions or topics, e.g. dynamic programming" className="!pl-10 !rounded-xl !border-outline-variant/70 !bg-surface-container-low" />
      </label>
      <label className="md:col-span-3">
        <span className="sr-only">Company</span>
        <select id="company" value={v.company ?? ""} onChange={set("company")} className={field}>
          <option value="">All companies</option>
          {companies.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </label>
      <label className="md:col-span-2">
        <span className="sr-only">Outcome</span>
        <select id="outcome" value={v.outcome ?? ""} onChange={set("outcome")} className={field}>
          <option value="">All outcomes</option>
          {OUTCOMES.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
        </select>
      </label>
      <div className="md:col-span-3 flex items-center gap-1">
        <Button type="submit" className="flex-1 !px-4">Search</Button>
        <Button type="button" variant="quiet" onClick={() => { setV({}); router.push("/archive"); }}>Clear</Button>
      </div>
    </form>
  );
}
