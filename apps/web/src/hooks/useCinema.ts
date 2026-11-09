"use client";

import { useEffect, useState } from "react";
import { hasWebGL } from "@/lib/webgl";

/**
 * True when the cinematic (WebGL, pinned) version of a section should run:
 * motion allowed, wide enough, WebGL present. False on the server and on first
 * render so the server HTML and the first client render always match (no
 * hydration mismatch); the page upgrades after mount.
 */
export function useCinema(minWidth = 960): boolean {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const wide = window.matchMedia(`(min-width: ${minWidth}px)`);
    const gl = hasWebGL();
    const update = () => setOk(motion.matches && wide.matches && gl);
    update();
    motion.addEventListener("change", update);
    wide.addEventListener("change", update);
    return () => {
      motion.removeEventListener("change", update);
      wide.removeEventListener("change", update);
    };
  }, [minWidth]);

  return ok;
}
