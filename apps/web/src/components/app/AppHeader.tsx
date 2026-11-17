"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/hooks/useMe";
import { buttonClass } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { RishihoodLogo, Wordmark } from "@/components/brand/Brand";

/**
 * Design source: Rishihood brand (ADR-29). A thin crimson-to-terracotta stripe over a frosted white bar: PrepLens wordmark,
 * the university logo beside it on wide screens, centre nav with a crimson underline for the current page, account on the right.
 * Behaviour: My posts / Profile show only when signed in, Admin only for admins, signed-out visitors see Sign in.
 */
const LINKS = [
  { href: "/archive", label: "Experiences", show: () => true },
  { href: "/submit", label: "Share yours", show: () => true },
  { href: "/me", label: "My posts", show: (s: boolean) => s },
  { href: "/admin", label: "Admin", show: (_s: boolean, admin?: boolean) => !!admin },
];

const SHELL = "fixed top-0 left-0 w-full z-50 bg-white/85 backdrop-blur-xl backdrop-saturate-150 border-b border-outline-variant/70";

/** usePathname() reads the URL at request time, so the bar sits in Suspense; the fallback is the same empty bar so the page does not jump. */
export function AppHeader() {
  return (
    <Suspense fallback={<header className={SHELL}><div className="brand-stripe" /><div className="h-[61px]" /></header>}>
      <HeaderBar />
    </Suspense>
  );
}

function HeaderBar() {
  const path = usePathname();
  const { me, signedIn, loading } = useMe();
  const isAdmin = me?.role === "admin";
  const linkCls = (active: boolean) =>
    `relative px-2.5 sm:px-3.5 py-2 text-[13px] sm:text-sm whitespace-nowrap font-medium transition-colors after:absolute after:left-3 after:right-3 after:-bottom-[13px] after:h-[2px] after:rounded-full after:transition-colors ${active ? "text-primary after:bg-primary" : "text-on-surface-variant hover:text-on-surface after:bg-transparent"}`;

  return (
    <header className={SHELL}>
      <div className="brand-stripe" />
      <div className="h-[61px] max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-6">
        <div className="flex items-center gap-4 shrink-0">
          <Link href="/" aria-label="PrepLens home" className="hover:opacity-85 transition-opacity">
            <Wordmark className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
          </Link>
          <span className="hidden lg:block h-7 w-px bg-outline-variant" aria-hidden="true" />
          <RishihoodLogo className="hidden lg:block h-7 w-auto" />
        </div>
        <nav aria-label="Main" className="flex items-center overflow-x-auto min-w-0 [scrollbar-width:none] max-sm:pr-4 max-sm:[mask-image:linear-gradient(90deg,#000_82%,transparent)]">
          {LINKS.filter((l) => l.show(signedIn, isAdmin)).map((l) => (
            <Link key={l.href} href={l.href} aria-current={path.startsWith(l.href) ? "page" : undefined} className={linkCls(path.startsWith(l.href))}>{l.label}</Link>
          ))}
        </nav>
        <div className="shrink-0">
          {signedIn ? (
            <Link href="/profile" aria-label="Your profile" className={`flex items-center gap-2 py-1 pl-1 pr-1 sm:pr-3 rounded-full border transition-colors ${path.startsWith("/profile") ? "border-primary/40 bg-primary-fixed" : "border-outline-variant hover:border-primary/40 hover:bg-surface-container-low"}`}>
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-maroon text-white flex items-center justify-center text-sm font-bold">{(me?.fullName ?? "?").charAt(0).toUpperCase()}</span>
              <span className="text-sm font-semibold hidden sm:inline">Profile</span>
            </Link>
          ) : (
            !loading && <Link href="/signin?next=/archive" className={`${buttonClass({ size: "sm" })} !px-3.5 sm:!px-4`}><span className="hidden sm:inline-flex"><Icon name="login" className="!text-[18px]" /></span>Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
