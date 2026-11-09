"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ExperienceDetail } from "@preplens/shared";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { ExperienceView } from "./ExperienceView";
import { ExperienceActions } from "./ExperienceActions";

/** A post that is not public can still be opened by its author and by admins. The server page cannot know who is asking, so this asks with the token. */
export function PrivateExperience({ id }: { id: string }) {
  const { token, loading } = useAuth();
  const [fetched, setX] = useState<ExperienceDetail | null | "none">(null);
  const x = loading ? null : !token ? "none" : fetched;

  useEffect(() => {
    if (loading || !token) return;
    api<ExperienceDetail>(`/api/v1/experiences/${id}`, { token }).then(setX).catch(() => setX("none"));
  }, [id, token, loading]);

  if (x === null) return <p className="empty">Looking for this experience…</p>;
  if (x === "none") {
    return (
      <div className="empty-state">
        <h2>We could not find this experience.</h2>
        <p>It may have been withdrawn, or it may not exist. If it is yours, sign in to see it.</p>
        <Link className="btn btn-primary" href={`/signin?next=/experience/${id}`}>Sign in</Link>
      </div>
    );
  }
  return (
    <div className="xlayout">
      <ExperienceView x={x} />
      <ExperienceActions id={id} initialUpvotes={x.upvoteCount} />
    </div>
  );
}
