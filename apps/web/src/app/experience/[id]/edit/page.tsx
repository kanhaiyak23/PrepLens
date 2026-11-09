import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/app/AppHeader";
import { EditForm } from "@/components/app/EditForm";

export const metadata: Metadata = { title: "Edit · PrepLens" };

export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <AppHeader />
      <main id="top" className="app-page on-paper">
        <div className="wrap narrow">
          <h1 className="display page-title">Edit your experience</h1>
          <p className="lede" style={{ marginBottom: 28 }}>Fix a detail, or update the result now that you know it.</p>
          <Suspense fallback={<p className="empty">Loading…</p>}>
            <Form params={params} />
          </Suspense>
        </div>
      </main>
    </>
  );
}

async function Form({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditForm id={id} />;
}
