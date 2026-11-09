import type { Metadata } from "next";
import { AppHeader } from "@/components/app/AppHeader";
import { MyPosts } from "@/components/app/MyPosts";

export const metadata: Metadata = { title: "Your content · PrepLens" };

export default function Page() {
  return (
    <>
      <AppHeader />
      <main id="top" className="app-page on-paper">
        <div className="wrap narrow">
          <h1 className="display page-title">Your content</h1>
          <p className="lede" style={{ marginBottom: 28 }}>What you have shared, and what you have saved.</p>
          <MyPosts />
        </div>
      </main>
    </>
  );
}
