import type { GuideSource, GuideView } from "@preplens/shared";
import type { GuideRepository, GuideSourceReader, LlmClient } from "../domain/ports.js";
import { NotEnoughDataError, NotFoundError, UpstreamError } from "../domain/errors.js";
import { CompanyGuide, buildPrompt, computeStats, fingerprintOf, groundContent, guideSchema } from "../domain/guide/CompanyGuide.js";
import type { Logger } from "../lib/logger.js";

/** Gemini's responseSchema is an OpenAPI subset. Kept here because it describes OUR output shape, not the vendor. */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    overview: { type: "STRING", description: "2-3 sentences on the overall process and what it rewards." },
    rounds: { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, focus: { type: "STRING" }, sources: { type: "ARRAY", items: { type: "INTEGER" } } }, required: ["name", "focus", "sources"] } },
    tips: { type: "ARRAY", items: { type: "OBJECT", properties: { text: { type: "STRING" }, sources: { type: "ARRAY", items: { type: "INTEGER" } } }, required: ["text", "sources"] } },
  },
  required: ["overview", "rounds", "tips"],
};

export const MIN_SOURCES = 3;

/**
 * Orchestrates: read sources, check the cache by fingerprint, generate if needed, ground, store.
 * Degrades gracefully: when the model is down, a previous guide is shown only if everything it cites is still published.
 */
export class GuideService {
  constructor(
    private readonly sources: GuideSourceReader,
    private readonly guides: GuideRepository,
    private readonly llm: LlmClient | null,
    private readonly logger: Logger,
    private readonly minSources = MIN_SOURCES,
  ) {}

  async getGuide(slug: string): Promise<GuideView> {
    const data = await this.sources.forCompany(slug);
    if (!data) throw new NotFoundError("Company not found.");
    const { company, experiences } = data;
    if (experiences.length < this.minSources) {
      throw new NotEnoughDataError(`A guide needs at least ${this.minSources} published experiences. ${company.name} has ${experiences.length}.`);
    }

    const fingerprint = fingerprintOf(experiences);
    const cached = await this.guides.find(company.id);
    if (cached && !cached.isStale(fingerprint)) return cached.toView(company, false);

    if (!this.llm) {
      if (cached && cached.citesOnly(new Set(experiences.map((e) => e.id)))) return cached.toView(company, true);
      throw new UpstreamError("The AI guide is not configured on this server.");
    }

    try {
      const { system, prompt } = buildPrompt(company.name, experiences);
      const raw = await this.llm.generateJson({ system, prompt, schema: RESPONSE_SCHEMA });
      const parsed = guideSchema.safeParse(raw.data);
      if (!parsed.success) throw new UpstreamError("The AI guide came back in an unexpected shape.");
      const content = groundContent(parsed.data, experiences.length);
      if (content.rounds.length === 0 && content.tips.length === 0) throw new UpstreamError("The AI guide could not be grounded in the experiences.");

      const snapshot: GuideSource[] = experiences.map((e, i) => ({ n: i + 1, id: e.id, role: e.role, interviewYear: e.interviewYear, outcome: e.outcome as GuideSource["outcome"], author: e.author }));
      const guide = new CompanyGuide(company.id, fingerprint, content, experiences.map((e) => e.id), snapshot, computeStats(experiences), raw.model, new Date());
      await this.guides.save(guide);   // upsert on company_id: concurrent generations settle on one row
      return guide.toView(company, false);
    } catch (err) {
      this.logger.warn({ err, company: slug }, "guide generation failed");
      if (cached && cached.citesOnly(new Set(experiences.map((e) => e.id)))) return cached.toView(company, true);
      throw err instanceof UpstreamError ? err : new UpstreamError("The AI guide is temporarily unavailable.");
    }
  }
}
