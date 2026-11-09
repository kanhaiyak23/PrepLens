"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SplitHeading } from "./SplitHeading";
import { Reveal } from "./Reveal";

export function Privacy() {
  const [anon, setAnon] = useState(false);

  return (
    <section className="sec on-dark" id="privacy" aria-labelledby="h-privacy">
      <div className="wrap privacy-grid">
        <Reveal>
          <p className="mono eyebrow accent" data-rise>
            Privacy
          </p>
          <SplitHeading text="Anonymous means *anonymous*." as="h2" className="display h2" />
          <p className="lede" data-rise style={{ marginTop: 24 }}>
            Batch and branch together can name a person in a group of sixty. So an anonymous post shows the batch only, and the branch is never sent to your browser.
          </p>
          <ul className="plain" data-rise>
            <li>Nothing is published until the author consents to public hosting.</li>
            <li>One click withdraws a post. No reason, no approval.</li>
            <li>Every admin removal is logged and cannot be edited.</li>
          </ul>
        </Reveal>

        <Reveal>
          <div className="byline" data-rise>
            <label className="toggle">
              <input type="checkbox" role="switch" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
              <span className="track" aria-hidden="true">
                <span className="knob" />
              </span>
              <span>Post anonymously</span>
            </label>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={String(anon)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} className="byline-body">
                <div className="who">
                  <div className={`avatar${anon ? " anon" : ""}`} aria-hidden="true">
                    {anon ? "" : "A"}
                  </div>
                  <div>
                    <div className="name">{anon ? "Anonymous" : "Asha Verma"}</div>
                    <div className="sub">{anon ? "2027" : "2027 · CSE · sample name"}</div>
                  </div>
                </div>
                <pre className="payload">
                  {anon ? (
                    <>
                      {`{ "anonymous": true,\n  "batch": 2027 }\n`}
                      <span className="strike">&quot;name&quot;</span>, <span className="strike">&quot;id&quot;</span>, <span className="strike">&quot;branch&quot;</span> not sent
                    </>
                  ) : (
                    `{ "name": "Asha Verma",\n  "batch": 2027,\n  "branch": "CSE" }`
                  )}
                </pre>
              </motion.div>
            </AnimatePresence>
            <p className="mono" style={{ color: "var(--fg-3)" }}>
              What the reader&apos;s browser receives · Sample
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
