import { Suspense } from "react";
import type { Metadata } from "next";
import { AppHeader } from "@/components/app/AppHeader";
import { AppFooter } from "@/components/app/AppFooter";
import { SignInCard } from "@/components/auth/SignInCard";

export const metadata: Metadata = { title: "Sign in · PrepLens" };

export default function SignInPage() {
  return (
    <>
      <AppHeader />
      <main id="top" className="pt-16 min-h-[80vh] flex items-center justify-center px-4 py-16 bg-surface-container-lowest">
        <Suspense fallback={null}><SignInCard /></Suspense>
      </main>
      <AppFooter />
    </>
  );
}
