import type { Metadata } from "next";
import { PageShell } from "@/components/app/PageShell";
import { SubmitForm } from "@/components/app/SubmitForm";

export const metadata: Metadata = { title: "Share your interview · PrepLens" };

export default function Page() {
  return (
    <PageShell eyebrow="Contribution flow" title="Share your interview" description="It is reviewed by an admin before it goes public." width="max-w-3xl">
      <SubmitForm />
    </PageShell>
  );
}
