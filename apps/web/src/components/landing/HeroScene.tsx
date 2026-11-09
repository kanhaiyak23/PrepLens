"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";

/** Hero atmosphere. Lazy: the Three.js chunk loads only here, after first paint. */
export default function HeroScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const [{ createHeroScene }, { readFonts, fontsReady }] = await Promise.all([
        import("@/lib/three/heroScene"),
        import("@/lib/three/fonts"),
      ]);
      await fontsReady();
      if (disposed) return;
      const light = window.matchMedia("(max-width: 960px)").matches;
      const scene = createHeroScene(canvas, host, readFonts(), light);
      let visible = true;
      const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
      io.observe(host);
      const onMove = (e: PointerEvent) => {
        const r = host.getBoundingClientRect();
        scene.setPointer((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5);
      };
      const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      if (finePointer) host.addEventListener("pointermove", onMove);
      const onResize = () => scene.resize();
      window.addEventListener("resize", onResize);
      const tick = () => {
        if (visible) {
          const p = Math.min(1, Math.max(0, window.scrollY / Math.max(1, host.clientHeight)));
          scene.setScroll(p);
          scene.render();
        }
      };
      gsap.ticker.add(tick);
      scene.intro();
      canvas.dataset.ready = "true";
      cleanup = () => {
        gsap.ticker.remove(tick);
        io.disconnect();
        host.removeEventListener("pointermove", onMove);
        window.removeEventListener("resize", onResize);
        scene.dispose();
      };
    })().catch((err) => console.warn("Hero scene unavailable", err));

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true" />;
}
