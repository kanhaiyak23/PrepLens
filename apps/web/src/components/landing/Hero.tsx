"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { gsap } from "@/lib/gsap";
import { useCinema } from "@/hooks/useCinema";
import { SplitHeading } from "./SplitHeading";

const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false });

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const typed = useRef<HTMLSpanElement>(null);
  const cinema = useCinema(0); // WebGL + motion allowed at any width; the scene itself goes light on small screens

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const words = el.querySelectorAll("[data-split]");
      const em = el.querySelector(".em-mark");
      gsap.set(words, { yPercent: 118, rotation: 4, transformOrigin: "0% 100%" });
      if (em) gsap.set(em, { backgroundSize: "0% 100%" });
      gsap.set(el.querySelectorAll("[data-rise]"), { y: 28, opacity: 0 });
      gsap.set(el.querySelectorAll("[data-round]"), { x: -12, opacity: 0 });

      const cleanups: (() => void)[] = [];
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.to(words, { yPercent: 0, rotation: 0, duration: 1.15, stagger: 0.07 }, 0.1)
        .to(em, { backgroundSize: "100% 100%", duration: 0.9, ease: "power3.inOut" }, 1.0)
        .to(el.querySelectorAll("[data-rise]"), { y: 0, opacity: 1, duration: 1, stagger: 0.1 }, 0.5)
        .to(el.querySelectorAll("[data-round]"), { x: 0, opacity: 1, duration: 0.6, stagger: 0.09 }, 1.9);

      // the search types itself: it is the one thing the card is demonstrating
      const text = "Example Co";
      const t = typed.current;
      if (t) {
        t.textContent = "";
        const o = { n: 0 };
        gsap.to(o, { n: text.length, duration: 0.7, delay: 1.0, ease: "none", onUpdate: () => (t.textContent = text.slice(0, Math.round(o.n))) });
      }

      // 3D tilt that follows the pointer (fine pointers only), plus a slow scroll-away
      const wrap = card.current;
      const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      const wide = window.matchMedia("(min-width: 961px)").matches;
      if (wrap && wide) {
        const baseY = -12;
        const baseX = 5;
        gsap.fromTo(wrap, { transformPerspective: 1300, rotationY: -36, rotationX: 14, opacity: 0 }, { transformPerspective: 1300, rotationY: baseY, rotationX: baseX, opacity: 1, duration: 1.8, delay: 0.3, ease: "expo.out", onComplete: arm });
        function arm() {
          if (!fine) return;
          const ry = gsap.quickTo(wrap, "rotationY", { duration: 0.9, ease: "power3.out" });
          const rx = gsap.quickTo(wrap, "rotationX", { duration: 0.9, ease: "power3.out" });
          const move = (e: PointerEvent) => {
            const r = el!.getBoundingClientRect();
            ry(baseY + ((e.clientX - r.left) / r.width - 0.5) * 18);
            rx(baseX - ((e.clientY - r.top) / r.height - 0.5) * 12);
          };
          const leave = () => {
            ry(baseY);
            rx(baseX);
          };
          el!.addEventListener("pointermove", move);
          el!.addEventListener("pointerleave", leave);
          cleanups.push(() => {
            el!.removeEventListener("pointermove", move);
            el!.removeEventListener("pointerleave", leave);
          });
        }
      } else if (wrap) {
        gsap.from(wrap, { y: 30, opacity: 0, duration: 1, delay: 0.5, ease: "expo.out" });
      }
      return () => cleanups.forEach((fn) => fn());
    });

    mm.add("(prefers-reduced-motion: reduce)", () => {
      if (typed.current) typed.current.textContent = "Example Co";
    });

    return () => mm.revert();
  }, []);

  return (
    <section ref={root} className="hero on-dark" aria-labelledby="h1">
      {cinema && <HeroScene />}
      <div className="wrap hero-grid">
        <div>
          <p className="mono eyebrow accent" data-rise>
            NST placement interviews, archived
          </p>
          <SplitHeading as="h1" text="Know what round two *actually* asks." className="display" />
          <p className="lede" data-rise style={{ marginTop: 28 }}>
            PrepLens is a public archive of interview experiences written by NST seniors. Search a company, read every
            round and question, and prepare from what was really asked.
          </p>
          <div className="hero-actions" data-rise>
            <a className="btn btn-primary" href="/archive">
              Browse the archive
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 10h12M11 5l5 5-5 5" />
              </svg>
            </a>
            <a className="btn btn-ghost" href="/signin?next=/welcome">
              Share your interview
            </a>
          </div>
          <p className="hero-note" data-rise>
            Reading is open to everyone. Posting needs an NST Google account.
          </p>
        </div>

        <div ref={card} className="hero-card-wrap">
          <div className="xp" role="img" aria-label="Sample interview experience with three rounds. Sample content, not a real post.">
            <div className="xp-bar">
              <span className="crumbs">preplens / archive / example-co</span>
              <span className="tag-sample">Sample</span>
            </div>
            <div className="xp-body">
              <div className="searchbar">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="9" cy="9" r="6" />
                  <path d="m14 14 4 4" />
                </svg>
                <span>
                  <span ref={typed}>Example Co</span>
                  <i className="caret" />
                </span>
              </div>
              <div className="xp-head">
                <div>
                  <h3>Example Co · SDE</h3>
                  <div className="meta">
                    <span>On-campus</span>
                    <span>Mar 2026</span>
                    <span>Anonymous · 2027</span>
                  </div>
                </div>
                <span className="chip good">Selected</span>
              </div>
              <div className="rounds">
                {[
                  ["01", "Online assessment", "Two array problems and one SQL query, 90 minutes."],
                  ["02", "Technical interview", "Reverse a linked list in place. Which edge cases did you test?"],
                  ["03", "HR conversation", "Walk through one project you would redo."],
                ].map(([n, t, q]) => (
                  <div className="round" key={n} data-round>
                    <div className="n">{n}</div>
                    <div className="c">
                      <div className="t">{t}</div>
                      <div className="q">{q}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
