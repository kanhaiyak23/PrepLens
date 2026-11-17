import Image from "next/image";
import Link from "next/link";
import { RishihoodLogo, Wordmark } from "@/components/brand/Brand";

/**
 * Design source: Rishihood brand (ADR-29). Deep maroon band with the campus line drawing along the bottom edge,
 * the PrepLens wordmark and purpose, real page links, the university logo, and an independence note.
 */
const EXPLORE = [
  { href: "/archive", label: "Browse experiences" },
  { href: "/submit", label: "Share your interview" },
  { href: "/me", label: "My posts" },
  { href: "/profile", label: "Profile" },
];

export function AppFooter() {
  return (
    <footer className="relative w-full mt-16 bg-maroon-deep text-inverse-on-surface overflow-hidden">
      <div className="brand-stripe" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-2 right-0 w-[min(760px,90%)] opacity-[0.045]">
        <Image src="/brand/campus-line.webp" alt="" width={1024} height={342} className="w-full h-auto" />
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-10 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-5 space-y-4">
          <Wordmark light />
          <p className="text-sm leading-relaxed text-inverse-on-surface/75 max-w-sm">
            Placement interview experiences from NST seniors, round by round, so the next batch walks in prepared.
          </p>
        </div>
        <nav aria-label="Footer" className="md:col-span-3 space-y-3">
          <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-gold">Explore</p>
          <ul className="space-y-2.5 text-sm">
            {EXPLORE.map((l) => <li key={l.href}><Link href={l.href} className="text-inverse-on-surface/80 hover:text-white transition-colors">{l.label}</Link></li>)}
          </ul>
        </nav>
        <div className="md:col-span-4 space-y-4">
          <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-gold">Built for</p>
          <RishihoodLogo light className="h-12 w-auto" />
          <p className="text-sm text-inverse-on-surface/75">Newton School of Technology students. Sign in with an <span className="font-semibold text-white">@nst.rishihood.edu.in</span> account.</p>
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row gap-2 justify-between text-xs text-inverse-on-surface/60">
          <p>© PrepLens. Every experience is shared by a student and reviewed before it goes public.</p>
          <p>An independent student project, not an official Rishihood University service.</p>
        </div>
      </div>
    </footer>
  );
}
