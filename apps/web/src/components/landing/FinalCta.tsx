"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { SplitHeading } from "./SplitHeading";
import { Reveal } from "./Reveal";
import { GoogleButton } from "@/components/auth/GoogleButton";

export function FinalCta() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const rings = el.querySelectorAll<SVGElement>(".iris circle");
      const blades = el.querySelector<SVGElement>(".iris-blades");
      gsap.set(rings, { transformOrigin: "50% 50%" });
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 85%", end: "center 55%", scrub: 0.7 }, defaults: { ease: "none" } });
      tl.fromTo(rings, { scale: 1.9, opacity: 0.2 }, { scale: 1, opacity: 1, stagger: 0.08, duration: 1 }, 0);
      if (blades) tl.fromTo(blades, { rotation: -60, scale: 1.4, transformOrigin: "50% 50%" }, { rotation: 0, scale: 1, duration: 1 }, 0);
      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
      };
    });
    return () => mm.revert();
  }, []);

  return (
    <section ref={root} className="sec final on-dark" aria-labelledby="h-final">
      <svg className="iris" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="0.5" aria-hidden="true">
        <circle cx="100" cy="100" r="76" />
        <circle cx="100" cy="100" r="54" />
        <g className="iris-blades" stroke="#f2b01e" strokeWidth="0.8">
          <path d="M100 6v34M194 100h-34M100 194v-34M6 100h34M33 33l24 24M167 33l-24 24M167 167l-24-24M33 167l24-24" />
        </g>
      </svg>
      <div className="wrap final-in">
        <Reveal>
          <SplitHeading text="Your interview helps the *next batch*." as="h2" className="display" />
        </Reveal>
        <p className="lede" style={{ color: "var(--fg-2)" }}>
          Write it up in two minutes, or add each round and question. An admin reviews it before it goes live, and you can withdraw it at any time.
        </p>
        <GoogleButton />
        <p className="mono" style={{ color: "var(--fg-3)" }}>
          Only @nst.rishihood.edu.in accounts can post
        </p>
      </div>
    </section>
  );
}
