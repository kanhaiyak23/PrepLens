import { Suspense } from "react";
import type { Metadata } from "next";
import { SignInCard } from "@/components/auth/SignInCard";

export const metadata: Metadata = { title: "Sign in · PrepLens" };

export default function SignInPage() {
  return (
    <main id="top" className="auth-page on-dark">
      <Suspense fallback={null}>
        <SignInCard />
      </Suspense>
    </main>
  );
}
