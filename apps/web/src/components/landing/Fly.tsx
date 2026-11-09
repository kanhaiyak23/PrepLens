"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useCinema } from "@/hooks/useCinema";
import { SAMPLE_ROUNDS } from "@/lib/three/rounds";
import { SplitHeading } from "./SplitHeading";
import { Reveal } from "./Reveal";

/**
 * "Every round, in order." Two renderings of one idea:
 *  - cinema: a pinned 3D fly-through (desktop, WebGL, motion allowed)
 *  - static: a four-frame strip (phones, reduced motion, no WebGL, no JS)
 * `useCinema` is false on the server and first client render, so both agree and hydration is clean.
 */
export function Fly() {
  const cinema = useCinema(960);
  return (
    <section className="fly on-dark" id="approach" aria-labelledby="h-fly">
      {cinema ? <FlyCinema /> : <FlyStatic />}
    </section>
  );
}

function FlyStatic() {
  return (
    <div className="fly-static">
      <div className="wrap">
        <Reveal>
          <p className="mono eyebrow accent" data-rise>
            Rounds
          </p>
          <SplitHeading text="Read an interview *one round* at a time." as="h2" className="display h2" />
          <p className="lede" data-rise style={{ marginTop: 24 }}>
            Every experience is split into the rounds a student sat through, in order, with the questions asked and one tip per round.
          </p>
        </Reveal>
        <Reveal>
          <div className="strip" role="group" aria-label="Sample rounds from an example interview">
            {SAMPLE_ROUNDS.map((r) => (
              <article className="frame" key={r.n} data-rise>
                <div className="no">
                  {r.n}
                  <small>{r.name}</small>
                </div>
                <p>{r.text}</p>
                <p className="tip">Tip: {r.tip}</p>
              </article>
            ))}
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function FlyCinema() {
  const root = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(-1);
  const [hintOn, setHintOn] = useState(true);
  const stRef = useRef<ScrollTrigger | null>(null);

  useEffect(() => {
    const el = root.current;
    const canvas = canvasRef.current;
    const stage = el?.querySelector<HTMLElement>(".fly-stage");
    if (!el || !canvas || !stage) return;

    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const [{ createFlyScene, roundIndexAt }, { readFonts, fontsReady }] = await Promise.all([
        import("@/lib/three/flyScene"),
        import("@/lib/three/fonts"),
      ]);
      await fontsReady();
      if (disposed) return;
      const scene = createFlyScene(canvas, stage, SAMPLE_ROUNDS, readFonts());
      let live = false;
      let last = -2;

      const st = ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: "+=320%",
        pin: stage,
        scrub: 0.8,
        anticipatePin: 1,
        onUpdate: (self) => {
          scene.setProgress(self.progress);
          const idx = roundIndexAt(self.progress);
          if (idx !== last) {
            last = idx;
            setActive(idx);
          }
          setHintOn(self.progress < 0.03);
        },
      });
      stRef.current = st;
      const vis = ScrollTrigger.create({ trigger: el, start: "top bottom", end: "bottom top", onToggle: (s) => (live = s.isActive) });
      const tick = () => {
        if (live) scene.render();
      };
      gsap.ticker.add(tick);

      const onMove = (e: PointerEvent) => {
        const r = stage.getBoundingClientRect();
        scene.setPointer((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5);
      };
      stage.addEventListener("pointermove", onMove);
      const onResize = () => {
        scene.resize();
        ScrollTrigger.refresh();
      };
      window.addEventListener("resize", onResize);
      ScrollTrigger.refresh();
      scene.render();

      cleanup = () => {
        gsap.ticker.remove(tick);
        stRef.current = null;
        st.kill();
        vis.kill();
        stage.removeEventListener("pointermove", onMove);
        window.removeEventListener("resize", onResize);
        scene.dispose();
      };
    })().catch((err) => console.warn("Fly-through unavailable", err));

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  const jump = (i: number) => {
    const st = stRef.current;
    if (!st) return;
    const centres = [0.175, 0.425, 0.675, 0.925];
    window.scrollTo({ top: st.start + centres[i] * (st.end - st.start), behavior: "smooth" });
  };

  return (
    <div ref={root}>
      <div className="fly-stage">
        <canvas ref={canvasRef} aria-hidden="true" />
        <div className="fly-vignette" aria-hidden="true" />
        <div className="fly-copy">
          <div className={`cap${active === -1 ? " on" : ""}`} aria-hidden={active !== -1}>
            <p className="mono eyebrow">Rounds</p>
            <h2 id="h-fly">Read an interview one round at a time.</h2>
            <p>Every experience is split into the rounds a student sat through, in order, with the questions asked and one tip per round. Scroll to fly through a sample.</p>
          </div>
          {SAMPLE_ROUNDS.map((r, i) => (
            <div className={`cap${active === i ? " on" : ""}`} key={r.n} aria-hidden={active !== i}>
              <p className="mono eyebrow">
                Round {r.n} of 04 · Sample
              </p>
              <h3>{r.name}</h3>
              <p>{r.text}</p>
              <p className="tip-line">
                <b>Tip</b>
                {r.tip}
              </p>
            </div>
          ))}
        </div>
        <ol className="fly-rail" aria-label="Jump to round">
          {SAMPLE_ROUNDS.map((r, i) => (
            <li key={r.n}>
              <button type="button" className={active === i ? "on" : ""} aria-label={`Round ${r.n}: ${r.name}`} aria-current={active === i} onClick={() => jump(i)}>
                {r.n}
              </button>
            </li>
          ))}
        </ol>
        <div className="fly-hint mono" aria-hidden="true" style={{ opacity: hintOn ? 1 : 0 }}>
          Scroll
          <i />
        </div>
      </div>
    </div>
  );
}
