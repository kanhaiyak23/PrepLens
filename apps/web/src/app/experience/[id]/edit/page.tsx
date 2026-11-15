import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/app/PageShell";
import { EditForm } from "@/components/app/EditForm";

export const metadata: Metadata = { title: "Edit · PrepLens" };

export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PageShell eyebrow="Your post" title="Edit your experience" description="Fix a detail, or update the result now that you know it." width="max-w-3xl">
      <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
        <Form params={params} />
      </Suspense>
    </PageShell>
  );
}

async function Form({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditForm id={id} />;
}
