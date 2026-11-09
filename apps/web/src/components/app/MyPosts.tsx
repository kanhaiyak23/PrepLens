"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BookmarkedCard, MyExperience, Page } from "@preplens/shared";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import { OUTCOME_CLASS, OUTCOME_LABEL, STATUS_CLASS, STATUS_LABEL, shortDate } from "@/lib/format";
import { ExperienceCard } from "./ExperienceCard";

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

  return (
    <>
      <div className="seg" role="tablist" aria-label="Your content">
        <button role="tab" aria-selected={tab === "posts"} onClick={() => setTab("posts")}>My posts</button>
        <button role="tab" aria-selected={tab === "saved"} onClick={() => setTab("saved")}>Saved</button>
        <span className="seg-thumb" style={{ transform: `translateX(${tab === "posts" ? 0 : 100}%)` }} aria-hidden="true" />
      </div>
      {error && <p role="alert" className="auth-error">{error}</p>}

      {tab === "posts" && (
        posts === null ? <p className="empty">Loading…</p> : posts.length === 0 ? (
          <div className="empty-state"><h2>You have not shared anything yet.</h2><p>Your first experience could save a junior a week of guessing.</p><Link className="btn btn-primary" href="/submit">Share your interview</Link></div>
        ) : (
          <ul className="mylist">
            {posts.map((p) => (
              <li key={p.id} className="myrow">
                <div>
                  <h2><Link href={`/experience/${p.id}`}>{p.companyName}</Link> <span className="muted">· {p.role} · {p.interviewYear}</span></h2>
                  <p className="xcard-meta"><span className={`chip ${OUTCOME_CLASS[p.outcome]}`}>{OUTCOME_LABEL[p.outcome]}</span><span>{p.roundCount} {p.roundCount === 1 ? "round" : "rounds"}</span><span>{p.upvoteCount} helpful</span><span>{shortDate(p.createdAt)}</span></p>
                  {p.reviewNote && <p className="rnote">Reviewer note: {p.reviewNote}</p>}
                </div>
                <div className="myside">
                  <span className={`chip ${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  {p.status !== "removed" && <Link className={`btn small ${p.status === "rejected" ? "btn-primary" : "btn-ghost"}`} href={`/experience/${p.id}/edit`}>{p.status === "rejected" ? "Edit and resubmit" : "Edit"}</Link>}
                  {(p.status === "published" || p.status === "pending") && <button className="btn btn-ghost small" disabled={busy === p.id} onClick={() => act(p.id, "unpublish")}>Withdraw</button>}
                  {p.status === "unpublished" && <button className="btn btn-primary small" disabled={busy === p.id} onClick={() => act(p.id, "republish")}>Send for review</button>}
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === "saved" && (
        saved === null ? <p className="empty">Loading…</p> : saved.length === 0 ? (
          <div className="empty-state"><h2>Nothing saved.</h2><p>Use Save for later on an experience to keep it here. Only you can see this list.</p><Link className="btn btn-primary" href="/archive">Browse the archive</Link></div>
        ) : <ul className="xgrid">{saved.map((x) => <ExperienceCard key={x.id} x={x} />)}</ul>
      )}
    </>
  );
}
