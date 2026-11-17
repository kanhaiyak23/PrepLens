import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SupabaseExperienceReader } from "../src/infrastructure/supabase/SupabaseExperienceReader.js";
import { SupabaseAdminQueueReader, SupabaseCompanyReader, SupabaseMyContentReader } from "../src/infrastructure/supabase/SupabaseReaders.js";
import { SupabaseExperienceWriter, SupabaseInteractionWriter, SupabaseModerationWriter, SupabaseProfileWriter, SupabaseReportWriter } from "../src/infrastructure/supabase/SupabaseWriters.js";
import { SupabaseProfileReader } from "../src/infrastructure/supabase/SupabaseProfileReader.js";
import { SupabaseTokenVerifier } from "../src/infrastructure/supabase/SupabaseTokenVerifier.js";
import { SupabaseAdminPostWriter, SupabaseAdminRoleWriter, SupabaseReportQueue, SupabaseUpdateReviewWriter, SupabaseAccountDeleter } from "../src/infrastructure/supabase/SupabaseAdminWriters.js";
import { SupabaseCompanyAdminWriter, SupabaseGuideRepository, SupabaseGuideSourceReader } from "../src/infrastructure/supabase/SupabaseGuide.js";
import { GeminiClient } from "../src/infrastructure/llm/GeminiClient.js";
import { FallbackLlmClient } from "../src/infrastructure/llm/FallbackLlmClient.js";
import { PostgresRateLimiter } from "../src/infrastructure/PostgresRateLimiter.js";

/**
 * The ports in domain/ports.ts are TypeScript interfaces, and every adapter says `implements <Port>`, so tsc already refuses an
 * adapter that is missing a method. This test keeps two guarantees the compiler does not give: each port is listed with a
 * real adapter (nothing is wired by name only), and the ports that must stay small, read-only or single-purpose stay that way
 * (Interface Segregation). It reads method names straight from the interface bodies.
 */
const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "../src/domain/ports.ts"), "utf8");

function portMethods(port: string): string[] {
  const match = source.match(new RegExp(`export interface ${port} \\{([\\s\\S]*?)\\n\\}`));
  expect(match, `port ${port} exists in ports.ts`).toBeTruthy();
  return [...match![1]!.matchAll(/^\s+(\w+)\(/gm)].map((m) => m[1]!);
}

const ADAPTERS: Record<string, { name: string; prototype: object }[]> = {
    ExperienceReader: [SupabaseExperienceReader],
    MyContentReader: [SupabaseMyContentReader],
    AdminQueueReader: [SupabaseAdminQueueReader],
    CompanyReader: [SupabaseCompanyReader],
    ExperienceWriter: [SupabaseExperienceWriter],
    InteractionWriter: [SupabaseInteractionWriter],
    ReportWriter: [SupabaseReportWriter],
    ModerationWriter: [SupabaseModerationWriter],
    ProfileReader: [SupabaseProfileReader],
    ProfileWriter: [SupabaseProfileWriter],
    RateLimiter: [PostgresRateLimiter],
    TokenVerifier: [SupabaseTokenVerifier],
    GuideSourceReader: [SupabaseGuideSourceReader],
    CompanyAdminWriter: [SupabaseCompanyAdminWriter],
    UpdateReviewWriter: [SupabaseUpdateReviewWriter],
    ReportQueue: [SupabaseReportQueue],
    AdminPostWriter: [SupabaseAdminPostWriter],
    LlmClient: [GeminiClient, FallbackLlmClient],
    GuideRepository: [SupabaseGuideRepository],
    AccountDeleter: [SupabaseAccountDeleter],
};

describe("every adapter implements its port", () => {
    for (const [port, classes] of Object.entries(ADAPTERS)) {
        it(`${port}`, () => {
            const methods = portMethods(port);
            expect(methods.length).toBeGreaterThan(0);
            for (const cls of classes) for (const m of methods) expect(typeof (cls.prototype as Record<string, unknown>)[m], `${cls.name}.${m}`).toBe("function");
        });
    }
});

describe("ports stay small (Interface Segregation)", () => {
    it("the moderation writer has exactly one method, and the rate limiter and token verifier one each", () => {
        expect(portMethods("ModerationWriter")).toEqual(["moderate"]);
        expect(portMethods("RateLimiter")).toEqual(["consume"]);
        expect(portMethods("TokenVerifier")).toEqual(["verify"]);
    });
    it("read ports have no write methods", () => {
        for (const port of ["ExperienceReader", "MyContentReader", "AdminQueueReader", "CompanyReader", "ProfileReader"])
            for (const m of portMethods(port)) expect(m).not.toMatch(/^(set|save|update|delete|insert|submit|moderate)/);
    });
});
