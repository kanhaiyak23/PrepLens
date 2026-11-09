import type { Metadata } from "next";
import { AppHeader } from "@/components/app/AppHeader";
import { AdminQueue } from "@/components/app/AdminQueue";
import { AdminCompanies } from "@/components/app/AdminCompanies";
import { AdminUpdates } from "@/components/app/AdminUpdates";
import { AdminReports } from "@/components/app/AdminReports";
import { AdminPostForm } from "@/components/app/AdminPostForm";

export const metadata: Metadata = { title: "Moderation · PrepLens" };

export default function Page() {
  return (
    <>
      <AppHeader />
      <main id="top" className="app-page on-paper">
        <div className="wrap narrow">
          <h1 className="display page-title">Moderation</h1>
          <p className="lede" style={{ marginBottom: 28 }}>Review what students share. Every decision is logged.</p>
          <AdminQueue />
          <AdminUpdates />
          <AdminReports />
          <AdminCompanies />
          <AdminPostForm />
        </div>
      </main>
    </>
  );
}
