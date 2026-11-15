import { Suspense } from "react";
import type { Metadata } from "next";
import type { ExperienceDetail } from "@preplens/shared";
import { PageShell } from "@/components/app/PageShell";
import { ExperienceView } from "@/components/app/ExperienceView";
import { ExperienceActions } from "@/components/app/ExperienceActions";
import { PrivateExperience } from "@/components/app/PrivateExperience";
import { Notice } from "@/components/ui/Notice";
import { ServerApiError, serverFetch } from "@/lib/serverApi";

export const metadata: Metadata = { title: "Experience · PrepLens" };

export default function ExperiencePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PageShell width="max-w-6xl">
      <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
        <Body params={params} />
      </Suspense>
    </PageShell>
  );
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data: ExperienceDetail | null = null;
  let hidden = false;
  let problem: string | null = null;
  try {
    data = (await serverFetch<{ data: ExperienceDetail }>(`/api/v1/experiences/${id}`)).data;
  } catch (e) {
    // 404 covers both "does not exist" and "not public": the author or an admin may still be allowed to see it.
    if (e instanceof ServerApiError && (e.status === 404 || e.status === 400)) hidden = true;
    else problem = e instanceof ServerApiError ? e.message : "Something went wrong.";
  }
  if (hidden) return <PrivateExperience id={id} />;
  if (problem || !data) return <Notice kind="error">{problem ?? "Something went wrong."}</Notice>;
  return (
    <div className="xlayout">
      <ExperienceView x={data} />
      <ExperienceActions id={id} initialUpvotes={data.upvoteCount} />
    </div>
  );
}
