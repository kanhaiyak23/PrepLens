"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";

/** Thin page-progress line. Scrubbed to the scroll position; purely informational. */
export function Progress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.to(ref.current, {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
      });
    });
    return () => mm.revert();
  }, []);

  return <div ref={ref} className="progress" aria-hidden="true" />;
}
