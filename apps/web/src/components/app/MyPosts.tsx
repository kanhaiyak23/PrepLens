"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BookmarkedCard, ExperienceStatus, MyExperience, Page } from "@preplens/shared";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import { OUTCOME_LABEL, OUTCOME_TONE, STATUS_LABEL, STATUS_TONE, shortDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Tabs } from "@/components/ui/Tabs";
import { ExperienceCard } from "./ExperienceCard";

/** A red bar on the left marks the row that needs the author to act. Design source: Stitch "My Posts", the "Not approved" row. */
const NEEDS_ACTION: ExperienceStatus[] = ["rejected"];

/**
 * Design source: Stitch "My Posts - PrepLens": info strip about editing, "My posts N / Saved N" tabs, a status summary on the right,
 * rows with status + outcome badges, role, meta line and the row's actions; a red-bordered row with a reviewer note for "Not approved".
 * Dropped: the view/upvote totals strip (views are not tracked) and "Delete draft" (there are no drafts, only withdrawn posts).
 */
export function MyPosts() {
  const router = useRouter();
  const { token, loading } = useAuth();
  const [tab, setTab] = useState<"posts" | "saved">("posts");
  const [posts, setPosts] = useState<MyExperience[] | null>(null);
  const [saved, setSaved] = useState<BookmarkedCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!token) { router.replace("/signin?next=/me"); return; }
    let live = true;
    Promise.all([api<MyExperience[]>("/api/v1/me/experiences", { token }), api<Page<BookmarkedCard>>("/api/v1/me/bookmarks?limit=50", { token })])
      .then(([p, b]) => { if (live) { setPosts(p); setSaved(Array.isArray(b) ? b : b.data); } })
      .catch((e: ApiError) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [loading, token, router, reload]);

  async function act(id: string, what: "unpublish" | "republish") {
    if (!token) return;
    setBusy(id); setError(null);
    try { await api(`/api/v1/experiences/${id}/${what}`, { token, method: "POST" }); setReload((n) => n + 1); }
    catch (e) { setError((e as ApiError).message); } finally { setBusy(null); }
  }

  const count = (s: ExperienceStatus) => posts?.filter((p) => p.status === s).length ?? 0;

  return (
    <div className="space-y-6">
      <Notice><b>Editing a published post</b> sends the changes for review. Readers keep seeing the old version until it is approved.</Notice>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs label="Your content" active={tab} onChange={setTab} items={[{ key: "posts", label: "My posts", count: posts?.length }, { key: "saved", label: "Saved", count: saved?.length }]} />
        {tab === "posts" && posts && posts.length > 0 && (
          <p className="flex flex-wrap items-center gap-4 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-[50%] bg-emerald-500" />{count("published")} published</span>
            <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-[50%] bg-amber-500" />{count("pending")} waiting for review</span>
            <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-[50%] bg-red-500" />{count("rejected")} need action</span>
          </p>
        )}
      </div>
      {error && <Notice kind="error">{error}</Notice>}

      {tab === "posts" && (
        posts === null ? <p className="text-on-surface-variant">Loading…</p> : posts.length === 0 ? (
          <EmptyState icon="edit_note" title="You have not shared anything yet." action={<ButtonLink href="/submit"><Icon name="add" className="!text-lg" />Share your interview</ButtonLink>}>Your first experience could save a junior a week of guessing.</EmptyState>
        ) : (
          <ul className="list-none p-0 m-0 space-y-4">
            {posts.map((p) => (
              <li key={p.id} className={`bg-surface-container-lowest border border-surface-variant rounded-xl p-5 sm:p-6 ${NEEDS_ACTION.includes(p.status) ? "border-l-4 !border-l-error" : ""} ${p.status === "unpublished" ? "bg-surface-container-low" : ""}`}>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <Badge tone={STATUS_TONE[p.status]} dot>{STATUS_LABEL[p.status]}</Badge>
                      <Badge tone={OUTCOME_TONE[p.outcome]}>{OUTCOME_LABEL[p.outcome]}</Badge>
                      <span className="text-xs text-on-surface-variant">{p.interviewYear}</span>
                    </p>
                    <h2 className="text-xl font-bold"><Link href={`/experience/${p.id}`} className="hover:text-primary">{p.companyName}</Link> <span className="font-normal text-on-surface-variant">· {p.role}</span></h2>
                    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                      <span className="flex items-center gap-1"><Icon name="layers" className="!text-sm" />{p.roundCount} {p.roundCount === 1 ? "round" : "rounds"}</span>
                      <span className="flex items-center gap-1"><Icon name="thumb_up" className="!text-sm" />{p.upvoteCount} found this helpful</span>
                      <span className="flex items-center gap-1"><Icon name="calendar_today" className="!text-sm" />Shared {shortDate(p.createdAt)}</span>
                    </p>
                    {p.reviewNote && <Notice kind="error" title="Reviewer note">{p.reviewNote}</Notice>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {p.status === "published" && <ButtonLink href={`/experience/${p.id}`} variant="quiet" size="sm"><Icon name="visibility" className="!text-base" />View public post</ButtonLink>}
                    {p.status !== "removed" && <ButtonLink href={`/experience/${p.id}/edit`} variant={p.status === "rejected" ? "primary" : "secondary"} size="sm"><Icon name={p.status === "rejected" ? "sync" : "edit"} className="!text-base" />{p.status === "rejected" ? "Edit and resubmit" : "Edit"}</ButtonLink>}
                    {(p.status === "published" || p.status === "pending") && <Button variant="quiet" size="sm" disabled={busy === p.id} onClick={() => act(p.id, "unpublish")}>Withdraw</Button>}
                    {p.status === "unpublished" && <Button size="sm" variant="secondary" disabled={busy === p.id} onClick={() => act(p.id, "republish")}><Icon name="send" className="!text-base" />Send for review</Button>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === "saved" && (
        saved === null ? <p className="text-on-surface-variant">Loading…</p> : saved.length === 0 ? (
          <EmptyState icon="bookmark" title="Nothing saved yet." action={<ButtonLink href="/archive">Browse experiences</ButtonLink>}>Use Save on an experience to keep it here. Only you can see this list.</EmptyState>
        ) : <ul className="grid grid-cols-1 gap-5 p-0 m-0">{saved.map((x) => <ExperienceCard key={x.id} x={x} />)}</ul>
      )}
    </div>
  );
}
