import type { Metadata } from "next";
import { PageShell } from "@/components/app/PageShell";
import { AdminConsole } from "@/components/app/AdminConsole";

export const metadata: Metadata = { title: "Admin · PrepLens" };

export default function Page() {
  return (
    <PageShell eyebrow="Placement portal · moderation" title="Admin moderation" description="Review what students share, handle reports, tidy company names. Every decision is logged." width="max-w-6xl">
      <AdminConsole />
    </PageShell>
  );
}
