"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SplitHeading } from "./SplitHeading";
import { Reveal } from "./Reveal";

/** Illustration only: the kind of fragments the archive replaces. Not quotes from real people. */
const FRAGMENTS: { t: string; x: number; y: number; r: number }[] = [
  { t: "was round 2 DSA or SQL?", x: 0, y: 6, r: -4 },
  { t: "they asked linked lists i think", x: 120, y: 78, r: 3 },
  { t: "OA was 90 mins, 3 questions", x: 14, y: 150, r: 5 },
  { t: "sending screenshot, check dm", x: 150, y: 222, r: -3 },
  { t: "which batch was this again?", x: 26, y: 294, r: 4 },
];
const ROUNDS = [
  ["01", "Online assessment", "90 minutes, three questions."],
  ["02", "Technical interview", "Linked lists. Which edge cases?"],
  ["03", "HR conversation", "Projects, mostly."],
];

export function Problem() {
  const [mode, setMode] = useState<"chat" | "archive">("chat");
  // On phones the fragments sit closer together so none is cut off by the panel.
  const [k, setK] = useState(1);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 520px)");
    const on = () => setK(m.matches ? 0.3 : 1);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  return (
    <section className="sec problem on-paper" id="problem" aria-labelledby="h-problem">
      <div className="wrap problem-grid">
        <Reveal>
          <p className="mono eyebrow" data-rise>
            The problem
          </p>
          <SplitHeading text="Interview experiences are scattered across *chat groups*." as="h2" className="display h2" />
          <p className="lede" data-rise style={{ marginTop: 24 }}>
            A junior with an interview in nine days cannot find out what round two asks from someone who sat in it. The answer exists. It is in a group chat from last March.
          </p>
        </Reveal>

        <Reveal>
          <div className="switch-panel" data-rise>
            <div className="seg" role="tablist" aria-label="Compare">
              <button role="tab" aria-selected={mode === "chat"} onClick={() => setMode("chat")}>
                Group chat
              </button>
              <button role="tab" aria-selected={mode === "archive"} onClick={() => setMode("archive")}>
                PrepLens
              </button>
              <span className="seg-thumb" style={{ transform: `translateX(${mode === "chat" ? 0 : 100}%)` }} aria-hidden="true" />
            </div>
            <div className="panel-body" role="tabpanel">
              <AnimatePresence mode="wait" initial={false}>
                {mode === "chat" ? (
                  <motion.div key="chat" className="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                    {FRAGMENTS.map((f, i) => (
                      <motion.div
                        key={f.t}
                        className="slip"
                        initial={{ opacity: 0, x: f.x * k, y: f.y + 24, rotate: f.r }}
                        animate={{ opacity: 1, x: f.x * k, y: f.y, rotate: f.r }}
                        transition={{ duration: 0.45, delay: i * 0.05, ease: [0.23, 1, 0.32, 1] }}
                      >
                        {f.t}
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div key="archive" className="rounds" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}>
                    {ROUNDS.map(([n, t, q]) => (
                      <div className="round" key={n}>
                        <div className="n">{n}</div>
                        <div className="c">
                          <div className="t">{t}</div>
                          <div className="q">{q}</div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <p className="mono" style={{ color: "var(--fg-3)", marginTop: 14 }}>
              Illustration · {mode === "chat" ? "Scattered fragments" : "The same information, in rounds"}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
