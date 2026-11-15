import type { Metadata } from "next";
import { PageShell } from "@/components/app/PageShell";
import { Profile } from "@/components/auth/Profile";

export const metadata: Metadata = { title: "Profile · PrepLens" };

export default function ProfilePage() {
  return (
    <PageShell eyebrow="Account" title="Student profile" description="Your campus details and what happens to your posts." width="max-w-3xl">
      <Profile />
    </PageShell>
  );
}
