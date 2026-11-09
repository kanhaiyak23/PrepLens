import type { Metadata } from "next";
import { Welcome } from "@/components/auth/Welcome";

export const metadata: Metadata = { title: "Your account · PrepLens" };

export default function WelcomePage() {
  return (
    <main id="top" className="auth-page on-dark">
      <Welcome />
    </main>
  );
}
