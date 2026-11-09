"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "@/hooks/useAuth";

const LINKS = [
  { href: "/archive", label: "Archive" },
  { href: "#approach", label: "Rounds" },
  { href: "#companies", label: "Companies" },
  { href: "#guide", label: "Prep guides" },
  { href: "#privacy", label: "Privacy" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const { user, loading } = useAuth();
  return (
    <header className="nav">
      <div className="wrap nav-in">
        <a className="brand" href="#top" aria-label="PrepLens home">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="16" cy="16" r="5" fill="#f2b01e" stroke="currentColor" strokeWidth="2.5" />
            <path d="M16 3v5M29 16h-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          PrepLens
        </a>
        <nav className="nav-links" aria-label="Primary">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="nav-cta">
          {!loading && (
            <a className="btn btn-ghost nav-signin" href={user ? "/welcome" : "/signin?next=/welcome"}>
              {user ? "Account" : "Sign in"}
            </a>
          )}
          <a className="btn btn-primary" href={user ? "/welcome" : "/signin?next=/welcome"}>
            Share your interview
          </a>
          <button
            className="menu-btn"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M4 4l12 12M16 4L4 16" /> : <path d="M3 6h14M3 14h14" />}
            </svg>
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            className="menu-panel"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          >
            {[...LINKS, { href: user ? "/welcome" : "/signin?next=/welcome", label: user ? "Account" : "Sign in" }].map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
