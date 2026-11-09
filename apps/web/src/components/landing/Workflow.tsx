"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { SplitHeading } from "./SplitHeading";
import { Reveal } from "./Reveal";

const STEPS = [
  { t: "Find the company", p: "Search by name, then narrow by role, outcome, year and campus." },
  { t: "Read the rounds", p: "Go through each round in order, with the questions asked and one tip per round." },
  { t: "Check the guide", p: "Open the prep guide for the company. Every claim cites the experiences behind it." },
  { t: "Share yours", p: "Sign in with your NST Google account, write it up, choose anonymous or named." },
];

export function Workflow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const steps = gsap.utils.toArray<HTMLElement>(".step", el);
      const line = el.querySelector<HTMLElement>(".flow-line");
      const st = ScrollTrigger.create({
        trigger: el,
        start: "top 70%",
        end: "bottom 60%",
        scrub: 0.5,
        onUpdate: (self) => {
          line?.style.setProperty("--p", String(self.progress));
          steps.forEach((s, i) => s.classList.toggle("on", self.progress >= (i + 0.2) / steps.length));
        },
      });
      return () => {
        st.kill();
      };
    });
    mm.add("(prefers-reduced-motion: reduce)", () => {
      ref.current?.querySelector<HTMLElement>(".flow-line")?.style.setProperty("--p", "1");
      ref.current?.querySelectorAll(".step").forEach((s) => s.classList.add("on"));
    });
    return () => mm.revert();
  }, []);

  return (
    <section className="sec on-paper" id="share" aria-labelledby="h-workflow">
      <div className="wrap">
        <Reveal>
          <p className="mono eyebrow" data-rise>
            How it works
          </p>
          <SplitHeading text="From the interview invite to *the interview*." as="h2" className="display h2" />
        </Reveal>

        <div ref={ref} className="flow">
          <div className="flow-line" aria-hidden="true">
            <i />
          </div>
          {STEPS.map((s, i) => (
            <div className="step" key={s.t}>
              <span className="no">{String(i + 1).padStart(2, "0")}</span>
              <h3>{s.t}</h3>
              <p>{s.p}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
