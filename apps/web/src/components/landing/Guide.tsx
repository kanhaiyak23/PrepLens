"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { SplitHeading } from "./SplitHeading";
import { Reveal } from "./Reveal";

const SOURCES = [
  { n: 1, t: "SDE, on-campus, 2026", a: "Anonymous · 2027" },
  { n: 2, t: "SDE, on-campus, 2025", a: "Anonymous · 2026" },
  { n: 3, t: "SDE Intern, off-campus, 2025", a: "Named author" },
];

export function Guide() {
  const [hl, setHl] = useState<number | null>(null);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const c = card.current;
            if (c) {
        gsap.fromTo(c, { rotationX: 16, yPercent: 6, transformPerspective: 1100, transformOrigin: "50% 100%" }, { rotationX: 0, yPercent: 0, ease: "none", scrollTrigger: { trigger: c, start: "top 92%", end: "top 45%", scrub: 0.6 } });
      }
      return () => ScrollTrigger.getAll().forEach((t) => (t.trigger === c) && t.kill());
    });
    return () => mm.revert();
  }, []);

  const cite = (n: number) => (
    <button
      key={n}
      type="button"
      className="cite"
      data-on={hl === n}
      aria-label={`Source ${n}`}
      onMouseEnter={() => setHl(n)}
      onMouseLeave={() => setHl(null)}
      onFocus={() => setHl(n)}
      onBlur={() => setHl(null)}
      onClick={() => setHl(n)}
    >
      {n}
    </button>
  );

  return (
    <section className="sec on-paper" id="guide" aria-labelledby="h-guide">
      <div className="wrap guide-grid">
        <div>
          <Reveal>
            <p className="mono eyebrow" data-rise>
              Prep guides
            </p>
            <SplitHeading text="A guide that shows its *sources*." as="h2" className="display h2" />
            <p className="rule-note" data-rise>
              For each company, PrepLens summarises what the archive says about the process. Every round and tip points to the experiences it came from, and the counts on the page are calculated from the posts, never written by the model.
            </p>
            <p className="rule-note" data-rise style={{ marginTop: 12 }}>
              Not enough experiences yet? The page says so instead of guessing.
            </p>
          </Reveal>
        </div>
        <div>
          <div ref={card}>
            <div className="guide-card" role="group" aria-label="Sample prep guide with citations. Sample content.">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <h3>Example Co</h3>
                <span className="tag-sample">Sample</span>
              </div>
              <p style={{ margin: 0, color: "var(--fg-2)" }}>
                An online assessment, one technical round and an HR conversation. Correctness and clear explanation count more than speed.
                {cite(1)}
                {cite(2)}
              </p>
              <div className="gr">
                <div className="t">Technical round</div>
                <p>
                  Linked lists and arrays, with questions on the edge cases you tested.
                  {cite(2)}
                  {cite(3)}
                </p>
              </div>
            </div>
            <div className="sources" aria-label="Source experiences for this sample guide">
              <div className="hd mono">Sources</div>
              {SOURCES.map((s) => (
                <div className="src" key={s.n} data-hl={hl === s.n}>
                  <span>{s.n}</span>
                  <div>
                    {s.t}
                    <small>{s.a}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
