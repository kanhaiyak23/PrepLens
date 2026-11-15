"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/hooks/useMe";
import { buttonClass } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/**
 * Design source: Stitch "PrepLens - Home" header: fixed white bar, wordmark left, centre nav
 * (Experiences, Share yours, My posts, Admin), profile link right; the current page gets a lilac pill.
 * Behaviour change from the mock: My posts / Profile show only when signed in, Admin only for admins,
 * and signed-out visitors see Sign in. The "NST · 2025" pill is dropped because it was static text.
 */
const LINKS = [
  { href: "/archive", label: "Experiences", show: () => true },
  { href: "/submit", label: "Share yours", show: () => true },
  { href: "/me", label: "My posts", show: (s: boolean) => s },
  { href: "/admin", label: "Admin", show: (_s: boolean, admin?: boolean) => !!admin },
];

/** usePathname() reads the URL at request time, so the bar sits in Suspense; the fallback is the same empty bar so the page does not jump. */
export function AppHeader() {
  return (
    <Suspense fallback={<header className="fixed top-0 left-0 w-full z-50 h-16 bg-surface-container-lowest border-b border-surface-variant" />}>
      <HeaderBar />
    </Suspense>
  );
}

function HeaderBar() {
  const path = usePathname();
  const { me, signedIn, loading } = useMe();
  const isAdmin = me?.role === "admin";
  const linkCls = (active: boolean) => `px-2 sm:px-3 py-1.5 text-[13px] sm:text-sm whitespace-nowrap rounded-lg transition-colors ${active ? "text-on-surface font-semibold bg-surface-container-low" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"}`;

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-surface-container-lowest border-b border-surface-variant">
      <div className="h-16 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-on-surface hover:opacity-80">
          <Icon name="lens_blur" className="text-primary !text-[26px]" />
          <span className="hidden sm:inline">PrepLens</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto min-w-0">
          {LINKS.filter((l) => l.show(signedIn, isAdmin)).map((l) => (
            <Link key={l.href} href={l.href} aria-current={path.startsWith(l.href) ? "page" : undefined} className={linkCls(path.startsWith(l.href))}>{l.label}</Link>
          ))}
        </nav>
        <div className="shrink-0">
          {signedIn ? (
            <Link href="/profile" className={`flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-surface-container-low ${path.startsWith("/profile") ? "bg-surface-container-low" : ""}`}>
              <span className="w-8 h-8 rounded-[50%] bg-secondary-container text-on-secondary-container flex items-center justify-center text-sm font-bold">{(me?.fullName ?? "?").charAt(0).toUpperCase()}</span>
              <span className="text-sm font-medium hidden sm:inline">Profile</span>
            </Link>
          ) : (
            !loading && <Link href="/signin?next=/archive" className={buttonClass({ size: "sm" })}>Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
