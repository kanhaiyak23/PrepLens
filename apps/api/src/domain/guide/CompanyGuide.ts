import { createHash } from "node:crypto";
import { z } from "zod";
import type { GuideSource, GuideView, PublicAuthor } from "@preplens/shared";

/** One published experience as the guide sees it. Authors are already anonymised by the database. */
export type SourceExperience = {
  id: string; role: string; driveType: string; interviewYear: number; outcome: string; updatedAt: string; author: PublicAuthor;
  rounds: { name: string; tips: string | null; questions: { text: string; topic: string | null }[] }[];
};
export type CompanySources = { company: { id: string; name: string; slug: string }; experiences: SourceExperience[] };

/** The shape the model must return. Citations are 1-based numbers into the source list. */
export const guideSchema = z.object({
  overview: z.string().min(1).max(1500),
  rounds: z.array(z.object({ name: z.string().min(1).max(120), focus: z.string().min(1).max(600), sources: z.array(z.number().int()) })).max(12),
  tips: z.array(z.object({ text: z.string().min(1).max(600), sources: z.array(z.number().int()) })).max(8),
});
export type GuideContent = z.infer<typeof guideSchema>;

/** Hash of source ids and update times. Any publish, edit or removal changes it, so staleness needs no hook in the write path (ADR-12). */
export function fingerprintOf(experiences: Pick<SourceExperience, "id" | "updatedAt">[]): string {
  const parts = [...experiences].sort((a, b) => a.id.localeCompare(b.id)).map((e) => `${e.id}:${new Date(e.updatedAt).getTime()}`);
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

/** Facts that are computed, never generated: counts and the most frequent question topics. */
export function computeStats(experiences: SourceExperience[], top = 5): GuideView["stats"] {
  const outcomes: Record<string, number> = {};
  const topics = new Map<string, { name: string; count: number }>();
  for (const e of experiences) {
    outcomes[e.outcome] = (outcomes[e.outcome] ?? 0) + 1;
    for (const r of e.rounds) for (const q of r.questions) {
      const name = q.topic?.trim();
      if (!name) continue;
      const k = name.toLowerCase();
      const cur = topics.get(k) ?? { name, count: 0 };
      cur.count += 1;
      topics.set(k, cur);
    }
  }
  return { experienceCount: experiences.length, outcomes, topTopics: [...topics.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, top) };
}

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
 * Grounding rule: keep only citations that point at a real source, and drop any round or tip left with none.
 * A claim that cites nothing real is not shown (ADR-12).
 */
export function groundContent(content: GuideContent, sourceCount: number): GuideContent {
  const valid = (ns: number[]) => [...new Set(ns.filter((n) => Number.isInteger(n) && n >= 1 && n <= sourceCount))].sort((a, b) => a - b);
  return {
    overview: content.overview,
    rounds: content.rounds.map((r) => ({ ...r, sources: valid(r.sources) })).filter((r) => r.sources.length > 0),
    tips: content.tips.map((t) => ({ ...t, sources: valid(t.sources) })).filter((t) => t.sources.length > 0),
  };
}

/** Entity: a generated guide and the facts needed to know whether it is still true. */
export class CompanyGuide {
  constructor(
    readonly companyId: string,
    readonly fingerprint: string,
    readonly content: GuideContent,
    readonly sourceIds: string[],
    readonly sourcesSnapshot: GuideSource[],
    readonly stats: GuideView["stats"],
    readonly model: string,
    readonly generatedAt: Date,
  ) {}

  isStale(currentFingerprint: string): boolean {
    return this.fingerprint !== currentFingerprint;
  }

  /**
   * Retraction rule: a guide may be shown past its freshness only if every post it cites is still published.
   * Otherwise withdrawn or removed content would live on inside a cached summary.
   */
  citesOnly(currentIds: ReadonlySet<string>): boolean {
    return this.sourceIds.every((id) => currentIds.has(id));
  }

  toView(company: { name: string; slug: string }, stale: boolean): GuideView {
    return {
      company, generatedAt: this.generatedAt.toISOString(), stale, stats: this.stats,
      overview: this.content.overview, rounds: this.content.rounds, tips: this.content.tips, sources: this.sourcesSnapshot,
    };
  }
}
