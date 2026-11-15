"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { safeNext } from "@/lib/safeNext";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { GoogleButton } from "./GoogleButton";

/** Design source: Stitch "Sign in - PrepLens": centred white card, lock tile, title, red "Access restricted" box, Google button, "Browse the archive" link. */
export function SignInCard() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const next = safeNext(params.get("next"));
  const error = params.get("error");

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

  return (
    <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-md p-8 sm:p-10 text-center">
      <div className="w-14 h-14 mx-auto mb-6 rounded-xl bg-primary-fixed text-primary flex items-center justify-center"><Icon name="lock_open" className="!text-3xl" /></div>
      <h1 className="text-3xl font-bold tracking-tight mb-3">Sign in</h1>
      <p className="text-on-surface-variant mb-6">Share your interview, save experiences for later and manage your posts.</p>
      {error && <div className="text-left mb-6"><Notice kind="error" title="Access restricted">{error}</Notice></div>}
      <GoogleButton next={next} className="w-full inline-flex items-center justify-center gap-3 bg-surface-container-low hover:bg-surface-container text-on-surface font-medium rounded-lg px-5 py-3 cursor-pointer" />
      <p className="text-sm text-on-surface-variant mt-4">Only <b className="font-medium text-on-surface">@nst.rishihood.edu.in</b> accounts can sign in. Reading never needs an account.</p>
      <div className="mt-8 pt-6 border-t border-surface-variant text-sm">
        <p className="text-on-surface-variant mb-2">Just looking to read experiences?</p>
        <Link href="/archive" className="font-semibold text-primary hover:underline">Browse the archive →</Link>
      </div>
    </div>
  );
}
