import { Suspense } from "react";
import Image from "next/image";
import type { Metadata } from "next";
import { AppHeader } from "@/components/app/AppHeader";
import { AppFooter } from "@/components/app/AppFooter";
import { SignInCard } from "@/components/auth/SignInCard";
import { RishihoodLogo } from "@/components/brand/Brand";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Sign in · PrepLens" };

const POINTS = ["Share your interview, anonymously if you like", "Save experiences to read before your interview", "Withdraw or update your posts any time"];

/** Design source: Rishihood brand (ADR-29): campus photograph panel with the university logo beside the sign-in card. */
export default function SignInPage() {
  return (
    <>
      <AppHeader />
      <main id="top" className="pt-16 min-h-[calc(100vh-4rem)] grid lg:grid-cols-2">
        <section className="relative isolate hidden lg:flex flex-col justify-between overflow-hidden bg-maroon-deep p-12 xl:p-16 text-white">
          <Image src="/brand/auditorium.webp" alt="" fill sizes="50vw" className="object-cover -z-20" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(160deg,rgb(43_7_16/0.92),rgb(74_10_26/0.80)_55%,rgb(158_6_38/0.70))]" />
          <RishihoodLogo light className="h-12 w-auto self-start" />
          <div className="max-w-md">
            <p className="eyebrow-rule text-gold mb-5">For NST students</p>
            <p className="font-display text-4xl xl:text-5xl leading-[1.08]">Your interview is someone&apos;s <em className="italic text-[#ffb3c0]">head start.</em></p>
            <ul className="mt-8 space-y-3 text-white/85 text-sm">
              {POINTS.map((p) => <li key={p} className="flex items-center gap-3"><Icon name="check_circle" className="!text-lg text-gold" />{p}</li>)}
            </ul>
          </div>
        </section>
        <section className="flex items-center justify-center px-4 py-16 bg-surface-container-low">
          <Suspense fallback={null}><SignInCard /></Suspense>
        </section>
      </main>
      <AppFooter />
    </>
  );
}
