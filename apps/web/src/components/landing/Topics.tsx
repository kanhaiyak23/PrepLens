"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { SplitHeading } from "./SplitHeading";
import { Reveal } from "./Reveal";

/** Sample topic counts to show how the tally reads. On the real site these are counted from published questions. */
const TOPICS: [string, number, string][] = [
  ["Arrays", 6, "Find the two numbers that add up to a target. What if the array is sorted?"],
  ["SQL", 4, "Write a query for the second-highest salary in each department."],
  ["Linked lists", 3, "Reverse a linked list in place. Which edge cases did you test?"],
  ["System design", 3, "Sketch a URL shortener. Where does it break at ten times the traffic?"],
  ["Projects", 2, "Walk through one project you would redo."],
];

export function Topics() {
  const ref = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const fills = el.querySelectorAll<HTMLElement>(".bar-fill");
      const counts = el.querySelectorAll<HTMLElement>("[data-count]");
      gsap.set(fills, { scaleX: 0 });
      const max = Math.max(...TOPICS.map((t) => t[1]));
      const tl = gsap.timeline({ paused: true });
      fills.forEach((f, i) => tl.to(f, { scaleX: TOPICS[i][1] / max, duration: 1.1, ease: "expo.out" }, i * 0.09));
      counts.forEach((c, i) => {
        const o = { n: 0 };
        c.textContent = "0";
        tl.to(o, { n: TOPICS[i][1], duration: 1.1, ease: "expo.out", onUpdate: () => (c.textContent = String(Math.round(o.n))) }, i * 0.09);
      });
      const st = ScrollTrigger.create({ trigger: el, start: "top 72%", once: true, onEnter: () => tl.play() });
      return () => {
        st.kill();
        tl.kill();
      };
    });
    return () => mm.revert();
  }, []);

  const max = Math.max(...TOPICS.map((t) => t[1]));
  return (
    <section className="sec on-dark" id="topics" aria-labelledby="h-topics">
      <div className="wrap topics-grid">
        <Reveal>
          <p className="mono eyebrow accent" data-rise>
            Questions asked again and again
          </p>
          <SplitHeading text="See what gets *asked* again." as="h2" className="display h2" />
          <p className="lede" data-rise style={{ marginTop: 24 }}>
            Every question can carry a topic. PrepLens counts them across published experiences, so the pattern for a company is a tally, not an opinion.
          </p>
          <p className="sample-note" data-rise>
            Sample counts shown here. On the live site they are calculated from real posts, never generated.
          </p>
        </Reveal>
        <div>
          <div ref={ref} className="bars" role="group" aria-label="Sample question topics. Select one to see a sample question.">
            {TOPICS.map(([name, n], i) => (
              <button key={name} type="button" className="bar-row" aria-pressed={sel === i} onClick={() => setSel(i)}>
                <span className="name">{name}</span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ display: "block", transform: `scaleX(${n / max})` }} />
                </span>
                <span className="count" data-count>
                  {n}
                </span>
              </button>
            ))}
          </div>
          <p className="q-sample" key={sel} aria-live="polite">
            <span className="mono">Sample question · {TOPICS[sel][0]}</span>
            {TOPICS[sel][2]}
          </p>
        </div>
      </div>
    </section>
  );
}
