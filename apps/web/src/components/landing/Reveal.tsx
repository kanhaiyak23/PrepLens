"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

/**
 * Scroll reveal for a block. Its [data-split] words lift out of their masks and its
 * [data-rise] children rise in with a short stagger. Plays once; skipped under reduced motion.
 */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const words = el.querySelectorAll("[data-split]");
      const rise = el.querySelectorAll("[data-rise]");
      if (words.length) gsap.set(words, { yPercent: 118, rotation: 3, transformOrigin: "0% 100%" });
      if (rise.length) gsap.set(rise, { y: 24, opacity: 0 });
      const tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out" } });
      if (words.length) tl.to(words, { yPercent: 0, rotation: 0, duration: 1, stagger: 0.06 }, 0);
      if (rise.length) tl.to(rise, { y: 0, opacity: 1, duration: 0.9, stagger: 0.08 }, 0.15);
      const st = ScrollTrigger.create({ trigger: el, start: "top 82%", once: true, onEnter: () => tl.play() });
      return () => {
        st.kill();
        tl.kill();
      };
    });
    return () => mm.revert();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
