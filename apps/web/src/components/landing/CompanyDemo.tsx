"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SplitHeading } from "./SplitHeading";
import { Reveal } from "./Reveal";

type Outcome = "Selected" | "Rejected" | "In process";
type Xp = { id: string; company: string; role: string; outcome: Outcome; year: number; drive: string; rounds: string[] };

/** Fictional companies and posts, shown only to demonstrate the real filters. Marked Sample on screen. */
const DATA: Xp[] = [
  { id: "a1", company: "Example Co", role: "SDE", outcome: "Selected", year: 2026, drive: "On-campus", rounds: ["Assessment", "Technical", "HR"] },
  { id: "a2", company: "Example Co", role: "SDE", outcome: "Rejected", year: 2025, drive: "Off-campus", rounds: ["Assessment", "Technical"] },
  { id: "a3", company: "Example Co", role: "Data Analyst", outcome: "In process", year: 2026, drive: "Referral", rounds: ["Assessment", "Case study", "HR"] },
  { id: "b1", company: "Sample Systems", role: "SDE", outcome: "Selected", year: 2026, drive: "On-campus", rounds: ["Assessment", "Technical", "System design", "HR"] },
  { id: "b2", company: "Sample Systems", role: "Data Analyst", outcome: "Rejected", year: 2025, drive: "On-campus", rounds: ["Assessment", "SQL round"] },
  { id: "c1", company: "Placeholder Labs", role: "SDE", outcome: "Selected", year: 2025, drive: "Off-campus", rounds: ["Technical", "Technical", "HR"] },
  { id: "c2", company: "Placeholder Labs", role: "SDE", outcome: "In process", year: 2026, drive: "On-campus", rounds: ["Assessment", "Technical"] },
];
const COMPANIES = ["Example Co", "Sample Systems", "Placeholder Labs"];
const OUTCOMES = ["All", "Selected", "Rejected", "In process"] as const;
const CLS: Record<Outcome, string> = { Selected: "good", Rejected: "bad", "In process": "blue" };

export function CompanyDemo() {
  const [company, setCompany] = useState(COMPANIES[0]);
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]>("All");

  const rows = useMemo(() => DATA.filter((d) => d.company === company && (outcome === "All" || d.outcome === outcome)), [company, outcome]);

  return (
    <section className="sec on-paper" id="companies" aria-labelledby="h-companies">
      <div className="wrap">
        <Reveal>
          <p className="mono eyebrow" data-rise>
            Company pages
          </p>
          <SplitHeading text="Start from the company you are *interviewing* with." as="h2" className="display h2" />
          <p className="lede" data-rise style={{ marginTop: 24 }}>
            Pick a company, then filter by outcome. The live site also filters by role, year and campus.
          </p>
        </Reveal>

        <Reveal>
          <div className="demo" data-rise>
            <div className="demo-bar">
              <div className="seg-row" role="tablist" aria-label="Sample companies">
                {COMPANIES.map((c) => (
                  <button key={c} role="tab" className="tab" aria-selected={company === c} onClick={() => setCompany(c)}>
                    {c}
                  </button>
                ))}
              </div>
              <div className="pillrow" role="group" aria-label="Outcome">
                {OUTCOMES.map((o) => (
                  <button key={o} className="pill" aria-pressed={outcome === o} onClick={() => setOutcome(o)}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
            <ul className="xplist" aria-live="polite">
              <AnimatePresence mode="popLayout" initial={false}>
                {rows.map((d) => (
                  <motion.li
                    key={d.id}
                    layout
                    className="xprow"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                  >
                    <div>
                      <h4>
                        {d.role} · {d.drive}
                      </h4>
                      <p className="path">{d.rounds.join("  →  ")}</p>
                    </div>
                    <span className="yr">{d.year}</span>
                    <span className={`chip ${CLS[d.outcome]}`}>{d.outcome}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            {rows.length === 0 && <p className="empty">No sample experiences match. Choose another outcome.</p>}
            <p className="mono demo-foot">Sample data</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
