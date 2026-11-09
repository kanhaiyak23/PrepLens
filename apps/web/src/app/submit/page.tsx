import type { Metadata } from "next";
import { AppHeader } from "@/components/app/AppHeader";
import { SubmitForm } from "@/components/app/SubmitForm";

export const metadata: Metadata = { title: "Share your interview · PrepLens" };

export default function Page() {
  return (
    <>
      <AppHeader />
      <main id="top" className="app-page on-paper">
        <div className="wrap narrow">
          <h1 className="display page-title">Share your interview</h1>
          <p className="lede" style={{ marginBottom: 28 }}>Your experience helps the next batch. It is reviewed before it goes public.</p>
          <SubmitForm />
        </div>
      </main>
    </>
  );
}
