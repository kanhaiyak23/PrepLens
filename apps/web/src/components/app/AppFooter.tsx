import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/**
 * Design source: Stitch footer (copyright, "Browse Archive", "Guidelines"), made roomier: a tinted band with the brand and a
 * one-line purpose on the left, real page links on the right, and the copyright on its own quiet line below.
 */
const LINKS = [
  { href: "/archive", label: "Experiences" },
  { href: "/submit", label: "Share yours" },
  { href: "/me", label: "My posts" },
];

export function AppFooter() {
  return (
    <footer className="w-full bg-surface-container-low border-t border-surface-variant mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row sm:items-start justify-between gap-8">
        <div className="max-w-sm space-y-2">
          <p className="flex items-center gap-2 font-bold text-lg"><Icon name="lens_blur" className="text-primary !text-[24px]" />PrepLens</p>
          <p className="text-sm text-on-surface-variant leading-relaxed">Interview experiences from NST seniors, round by round, so you know what to prepare.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          {LINKS.map((l) => <Link key={l.href} href={l.href} className="text-on-surface-variant hover:text-primary font-medium">{l.label}</Link>)}
        </nav>
      </div>
      <div className="border-t border-surface-variant">
        <p className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-xs text-on-surface-variant">© PrepLens. All interview experiences are shared by students and reviewed by an admin before they go public.</p>
      </div>
    </footer>
  );
}
