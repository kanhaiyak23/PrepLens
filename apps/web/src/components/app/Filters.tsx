"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CAMPUSES, OUTCOMES, type CompanySummary } from "@preplens/shared";
import { CAMPUS_LABEL, OUTCOME_LABEL } from "@/lib/format";

type Values = { q?: string; company?: string; outcome?: string; year?: string; campus?: string; role?: string; sort?: string };

/** Filters live in the URL, so a filtered archive can be shared, bookmarked and reloaded (deep links). */
export function Filters({ values, companies }: { values: Values; companies: CompanySummary[] }) {
  const router = useRouter();
  const [v, setV] = useState<Values>(values);
  const years = [2026, 2025, 2024, 2023];

  function apply(next: Values) {
    const p = new URLSearchParams();
    Object.entries(next).forEach(([k, val]) => val && p.set(k, val));
    router.push(`/archive${p.size ? `?${p}` : ""}`);
  }
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const next = { ...v, [k]: e.target.value };
    setV(next);
    if (k !== "q" && k !== "role") apply(next);
  };

  return (
    <form className="filters" role="search" onSubmit={(e) => { e.preventDefault(); apply(v); }}>
      <label className="f-search">
        <span className="mono">Search questions</span>
        <input id="q" type="search" value={v.q ?? ""} onChange={set("q")} placeholder="linked list, SQL join…" />
      </label>
      <label>
        <span className="mono">Company</span>
        <select id="company" value={v.company ?? ""} onChange={set("company")}>
          <option value="">All</option>
          {companies.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </label>
      <label>
        <span className="mono">Outcome</span>
        <select id="outcome" value={v.outcome ?? ""} onChange={set("outcome")}>
          <option value="">All</option>
          {OUTCOMES.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
        </select>
      </label>
      <label>
        <span className="mono">Year</span>
        <select id="year" value={v.year ?? ""} onChange={set("year")}>
          <option value="">All</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <label>
        <span className="mono">Campus</span>
        <select id="campus" value={v.campus ?? ""} onChange={set("campus")}>
          <option value="">All</option>
          {CAMPUSES.map((c) => <option key={c} value={c}>{CAMPUS_LABEL[c]}</option>)}
        </select>
      </label>
      <label>
        <span className="mono">Role</span>
        <input id="role" value={v.role ?? ""} onChange={set("role")} placeholder="SDE" />
      </label>
      <label>
        <span className="mono">Sort by</span>
        <select id="sort" value={v.sort ?? "newest"} onChange={(e) => { const next = { ...v, sort: e.target.value === "newest" ? undefined : e.target.value }; setV(next); apply(next); }}>
          <option value="newest">Newest shared</option>
          <option value="interview">Interview date</option>
        </select>
      </label>
      <div className="f-actions">
        <button className="btn btn-primary" type="submit">Search</button>
        <button className="btn btn-ghost" type="button" onClick={() => { setV({}); router.push("/archive"); }}>Clear</button>
      </div>
    </form>
  );
}
