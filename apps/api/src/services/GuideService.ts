/**
 * services/GuideService.ts — THE AI PREP GUIDE FOR A COMPANY
 *
 * What it does, step by step:
 *   1. Get the company's published posts. Fewer than 3 -> "not enough data yet".
 *   2. Make a "fingerprint" of those posts. If a saved guide has the same fingerprint, return it (cache hit, no AI call).
 *   3. Otherwise ask Gemini for a guide in a fixed JSON shape, where every round and tip cites post numbers.
 *   4. Check the AI's answer: wrong shape -> error; citations to posts that don't exist -> dropped ("grounding").
 *   5. Counts and top topics are calculated by our code, never by the AI (so numbers can't be invented).
 *   6. Save the guide and return it.
 *   If the AI fails, show the previous guide (marked as possibly out of date) — but only if every post it cites is still published.
 *
 * System design:
 * - Grounded AI generation (a light form of RAG): the AI only summarises our real posts, and every claim must point to a source.
 * - Caching with fingerprint invalidation: the guide is rebuilt only when the posts change. Saves AI cost and time.
 * - Graceful degradation: AI down -> serve the old guide or a clean 503 error; the rest of the site is unaffected.
 * - Structured output: the AI must answer in a JSON schema, which is then validated (never trust external output).
 * - Dependency Inversion: uses LlmClient, GuideRepository and GuideSourceReader interfaces — no Gemini or Supabase code here.
 */
import type { GuideSource, GuideView } from "@preplens/shared";
import type { GuideRepository, GuideSourceReader, LlmClient } from "../domain/ports.js";
import { NotEnoughDataError, NotFoundError, UpstreamError } from "../domain/errors.js";
import { CompanyGuide, buildPrompt, computeStats, fingerprintOf, groundContent, guideSchema } from "../domain/guide/CompanyGuide.js";
import type { Logger } from "../lib/logger.js";

/** The JSON shape we force the AI to answer in: an overview, rounds (each citing sources) and tips (each citing sources). */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    overview: { type: "STRING", description: "2-3 sentences on the overall process and what it rewards." },
    rounds: { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, focus: { type: "STRING" }, sources: { type: "ARRAY", items: { type: "INTEGER" } } }, required: ["name", "focus", "sources"] } },
    tips: { type: "ARRAY", items: { type: "OBJECT", properties: { text: { type: "STRING" }, sources: { type: "ARRAY", items: { type: "INTEGER" } } }, required: ["text", "sources"] } },
  },
  required: ["overview", "rounds", "tips"],
};

/** A guide needs at least this many published posts, so it isn't one person's opinion. */
export const MIN_SOURCES = 3;

export class GuideService {
  constructor(
    private readonly sources: GuideSourceReader, // reads the company's published posts
    private readonly guides: GuideRepository,    // saves / loads cached guides
    private readonly llm: LlmClient | null,      // the AI (null if no API key is set)
    private readonly logger: Logger,
    private readonly minSources = MIN_SOURCES,
  ) {}

  async getGuide(slug: string): Promise<GuideView> {
    // 1. The company and its posts.
    const data = await this.sources.forCompany(slug);
    if (!data) throw new NotFoundError("Company not found.");
    const { company, experiences } = data;
    if (experiences.length < this.minSources) {
      throw new NotEnoughDataError(`A guide needs at least ${this.minSources} published experiences. ${company.name} has ${experiences.length}.`);
    }

    // 2. Cache check: same fingerprint = same posts = the saved guide is still correct.
    const fingerprint = fingerprintOf(experiences);
    const cached = await this.guides.find(company.id);
    if (cached && !cached.isStale(fingerprint)) return cached.toView(company, false);

    // No AI configured: show the old guide if it is still safe, otherwise 503.
    if (!this.llm) {
      if (cached && cached.citesOnly(new Set(experiences.map((e) => e.id)))) return cached.toView(company, true);
      throw new UpstreamError("The AI guide is not configured on this server.");
    }

    try {
      // 3. Ask the AI, forcing our JSON shape.
      const { system, prompt } = buildPrompt(company.name, experiences);
      const raw = await this.llm.generateJson({ system, prompt, schema: RESPONSE_SCHEMA });
      // 4. Validate the answer, then drop any citation that doesn't point to a real post.
      const parsed = guideSchema.safeParse(raw.data);
      if (!parsed.success) throw new UpstreamError("The AI guide came back in an unexpected shape.");
      const content = groundContent(parsed.data, experiences.length);
      if (content.rounds.length === 0 && content.tips.length === 0) throw new UpstreamError("The AI guide could not be grounded in the experiences.");

      // 5. Keep a snapshot of the sources (so citations still make sense later) and compute stats in code.
      const snapshot: GuideSource[] = experiences.map((e, i) => ({ n: i + 1, id: e.id, role: e.role, interviewYear: e.interviewYear, outcome: e.outcome as GuideSource["outcome"], author: e.author }));
      const guide = new CompanyGuide(company.id, fingerprint, content, experiences.map((e) => e.id), snapshot, computeStats(experiences), raw.model, new Date());
      // 6. Save. "Upsert" on the company id: if two requests generate at the same time, they end up as one row.
      await this.guides.save(guide);
      return guide.toView(company, false);
    } catch (err) {
      // Graceful degradation: AI failed -> serve the old guide (marked stale) if all its sources are still published.
      this.logger.warn({ err, company: slug }, "guide generation failed");
      if (cached && cached.citesOnly(new Set(experiences.map((e) => e.id)))) return cached.toView(company, true);
      throw err instanceof UpstreamError ? err : new UpstreamError("The AI guide is temporarily unavailable.");
    }
  }
}
