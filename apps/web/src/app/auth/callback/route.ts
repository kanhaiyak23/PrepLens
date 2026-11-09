import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safeNext";

/** Maps provider / database failures to words a student can act on. */
function friendly(raw: string): string {
  const t = raw.toLowerCase();
  if (t.includes("database error saving new user") || t.includes("nst.rishihood.edu.in") || t.includes("only @nst")) {
    return "Only @nst.rishihood.edu.in Google accounts can sign in. Please choose your college account.";
  }
  if (t.includes("access_denied") || t.includes("access denied")) return "Sign-in was cancelled.";
  return "We could not sign you in. Please try again.";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));
  const problem = searchParams.get("error_description") ?? searchParams.get("error");
  if (problem) return NextResponse.redirect(`${origin}/signin?error=${encodeURIComponent(friendly(problem))}`);

  const code = searchParams.get("code");
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(`${origin}/signin?error=${encodeURIComponent(friendly(error.message))}`);
  }
  return NextResponse.redirect(`${origin}/signin?error=${encodeURIComponent("The sign-in link was incomplete. Please try again.")}`);
}
