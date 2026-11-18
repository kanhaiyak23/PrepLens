/**
 * domain/guide/CompanyGuide.ts — THE RULES OF THE AI PREP GUIDE
 *
 * What it does:
 *   - guideSchema: the exact shape the AI must answer in (checked with Zod).
 *   - fingerprintOf(): a hash of the source posts, used to know when the cached guide is out of date.
 *   - computeStats(): the numbers (how many posts, outcomes, top topics) — computed by OUR code, never by the AI.
 *   - buildPrompt(): the instructions and numbered posts sent to the AI.
 *   - groundContent(): drops any AI claim that doesn't cite a real post.
 *   - CompanyGuide class: one saved guide, which knows if it is stale and whether it is still safe to show.
 *
 * System design:
 * - Grounded generation (light RAG): the AI may only use the numbered posts we give it, and must cite them.
 * - Never trust external output: the AI's answer is validated against a schema, and bad citations are removed.
 * - Deterministic facts in code: numbers can't be "hallucinated" because the AI never produces them.
 * - Cache invalidation by content fingerprint (ADR-12): any publish, edit or removal changes the hash, so we know the
 *   guide is stale without adding extra code to every write.
 * - Domain entity with behaviour (OOP): CompanyGuide holds its data AND its rules (isStale, citesOnly, toView).
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import type { GuideSource, GuideView, PublicAuthor } from "@preplens/shared";

/** One published post, as the guide sees it. Authors are already anonymised by the database. */
export type SourceExperience = {
  id: string; role: string; driveType: string; interviewYear: number; outcome: string; updatedAt: string; author: PublicAuthor;
  rounds: { name: string; tips: string | null; questions: { text: string; topic: string | null }[] }[];
};
/** A company plus all its published posts. */
export type CompanySources = { company: { id: string; name: string; slug: string }; experiences: SourceExperience[] };

/** The shape the AI must return. "sources" are post numbers, starting from 1. Limits stop runaway answers. */
export const guideSchema = z.object({
  overview: z.string().min(1).max(1500),
  rounds: z.array(z.object({ name: z.string().min(1).max(120), focus: z.string().min(1).max(600), sources: z.array(z.number().int()) })).max(12),
  tips: z.array(z.object({ text: z.string().min(1).max(600), sources: z.array(z.number().int()) })).max(8),
});
export type GuideContent = z.infer<typeof guideSchema>;

/**
 * Fingerprint = SHA-256 hash of every source post's id + last-updated time (sorted, so order doesn't matter).
 * If any post is added, edited or removed, the fingerprint changes and the cached guide is known to be stale.
 */
export function fingerprintOf(experiences: Pick<SourceExperience, "id" | "updatedAt">[]): string {
  const parts = [...experiences].sort((a, b) => a.id.localeCompare(b.id)).map((e) => `${e.id}:${new Date(e.updatedAt).getTime()}`);
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

/** Counts and top topics, computed in code (never generated): total posts, outcomes, and the most common question topics. */
export function computeStats(experiences: SourceExperience[], top = 5): GuideView["stats"] {
  const outcomes: Record<string, number> = {};
  const topics = new Map<string, { name: string; count: number }>();
  for (const e of experiences) {
    outcomes[e.outcome] = (outcomes[e.outcome] ?? 0) + 1;
    for (const r of e.rounds) for (const q of r.questions) {
      const name = q.topic?.trim();
      if (!name) continue;
      const k = name.toLowerCase(); // "DP" and "dp" count as the same topic
      const cur = topics.get(k) ?? { name, count: 0 };
      cur.count += 1;
      topics.set(k, cur);
    }
  }
  return { experienceCount: experiences.length, outcomes, topTopics: [...topics.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, top) };
}

/** Builds what we send to the AI: strict instructions (system) + every post as a numbered block [1], [2]... (prompt). */
export function buildPrompt(companyName: string, experiences: SourceExperience[]): { system: string; prompt: string } {
  const blocks = experiences.map((e, i) => {
    const rounds = e.rounds.map((r, j) => {
      const qs = r.questions.map((q) => `    - ${q.text}${q.topic ? ` (topic: ${q.topic})` : ""}`).join("\n");
      return `  Round ${j + 1}: ${r.name}${qs ? `\n${qs}` : ""}${r.tips ? `\n    Notes: ${r.tips}` : ""}`;
    }).join("\n");
    return `[${i + 1}] ${e.role}, ${e.driveType}, ${e.interviewYear}, outcome: ${e.outcome}\n${rounds}`;
  });
  return {
    system:
      "You summarise placement interview experiences for students. Use ONLY the numbered experiences provided. " +
      "Never invent facts, companies, questions or numbers. Every round and every tip must cite the experience numbers it comes from. " +
      "Do not mention people. Write plainly.",
    prompt: `Company: ${companyName}\n\nExperiences:\n\n${blocks.join("\n\n")}`,
  };
}

/**
 * Grounding rule (ADR-12): keep only citations that point to a real post (1..sourceCount), remove duplicates,
 * and drop any round or tip that has no real citation left. A claim that cites nothing real is never shown.
 */
export function groundContent(content: GuideContent, sourceCount: number): GuideContent {
  const valid = (ns: number[]) => [...new Set(ns.filter((n) => Number.isInteger(n) && n >= 1 && n <= sourceCount))].sort((a, b) => a - b);
  return {
    overview: content.overview,
    rounds: content.rounds.map((r) => ({ ...r, sources: valid(r.sources) })).filter((r) => r.sources.length > 0),
    tips: content.tips.map((t) => ({ ...t, sources: valid(t.sources) })).filter((t) => t.sources.length > 0),
  };
}

/** One saved guide, plus what we need to know whether it is still true. */
export class CompanyGuide {
  constructor(
    readonly companyId: string,
    readonly fingerprint: string,          // hash of the posts it was built from
    readonly content: GuideContent,        // overview, rounds, tips
    readonly sourceIds: string[],          // ids of the posts it cites
    readonly sourcesSnapshot: GuideSource[], // short description of each source, so [1], [2] stay readable
    readonly stats: GuideView["stats"],    // computed numbers
    readonly model: string,                // which AI model wrote it
    readonly generatedAt: Date,
  ) {}

  /** Out of date if the posts have changed since it was made. */
  isStale(currentFingerprint: string): boolean {
    return this.fingerprint !== currentFingerprint;
  }

  /**
   * Retraction rule: an out-of-date guide may still be shown (e.g. when the AI is down) ONLY if every post it cites is
   * still published. Otherwise content an author withdrew, or an admin removed, would live on inside the summary.
   */
  citesOnly(currentIds: ReadonlySet<string>): boolean {
    return this.sourceIds.every((id) => currentIds.has(id));
  }

  /** The shape sent to the website. `stale` = true tells the page to show "may be out of date". */
  toView(company: { name: string; slug: string }, stale: boolean): GuideView {
    return {
      company, generatedAt: this.generatedAt.toISOString(), stale, stats: this.stats,
      overview: this.content.overview, rounds: this.content.rounds, tips: this.content.tips, sources: this.sourcesSnapshot,
    };
  }
}
