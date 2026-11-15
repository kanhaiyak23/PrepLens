/**
 * Ports (ADR-01, ADR-23). Services depend on these contracts and never on Supabase.
 * They are split by purpose (Interface Segregation): a reader has no write methods, and the moderation
 * writer has no other methods. JavaScript has no interfaces, so each port is a JSDoc typedef: the contract
 * lives here, adapters in infrastructure/ implement it, and tests/fakes.js provides in-memory versions.
 *
 * Shared DTO types (ExperienceCard, FeedQuery, ...) come from @preplens/shared.
 *
 * @typedef {{ at: string, id: string }} Keyset
 *
 * @typedef {{ name: string, tips?: string, questions: { text: string, topic?: string }[] }} RoundPayload
 * The shape the database function expects. Always rounds: quick and detailed forms are normalised before this point.
 * @typedef {{ company: string, role: string, driveType: string, interviewYear: number, interviewMonth?: number,
 *   outcome: string, isAnonymous: boolean, consent: true, rounds: RoundPayload[] }} SubmitPayload
 * @typedef {Omit<SubmitPayload, "consent"> & { studentConsented: true, authorName: string, authorBatch: number,
 *   authorBranch: string, campus: string }} AdminPostPayload
 *
 * @typedef {object} ExperienceReader
 * @property {(q: object) => Promise<object[]>} findPage  FeedQuery minus cursor, plus sort, after (FeedAfter) and limit
 * @property {(id: string) => Promise<object | null>} findById
 *
 * @typedef {object} MyContentReader
 * @property {() => Promise<object[]>} listMine
 * @property {(q: { after?: Keyset, limit: number }) => Promise<object[]>} listBookmarks
 *
 * @typedef {object} AdminQueueReader
 * @property {(q: { status: string, after?: Keyset, limit: number }) => Promise<object[]>} list
 *
 * @typedef {object} CompanyReader
 * @property {(q: { prefix?: string, limit: number }) => Promise<object[]>} list
 *
 * @typedef {object} ExperienceWriter
 * @property {(p: SubmitPayload) => Promise<string>} submit
 * @property {(id: string, publish: boolean) => Promise<string>} setVisibility
 * @property {(id: string, changes: Record<string, unknown>) => Promise<"applied" | "queued">} update
 *   A live post queues the change for review; any other post is edited directly.
 * @property {(id: string) => Promise<void>} cancelUpdate
 *
 * @typedef {object} InteractionWriter
 * @property {(id: string, on: boolean) => Promise<{ voted: boolean, upvoteCount: number }>} setVote
 * @property {(id: string, on: boolean) => Promise<{ bookmarked: boolean }>} setBookmark
 * @property {(ids: string[]) => Promise<object>} interactions
 *
 * @typedef {object} ReportWriter
 * @property {(id: string, reason: string, note?: string) => Promise<string>} report
 *
 * @typedef {object} ModerationWriter
 * Append-only by construction: the only method is a decision, and the database logs it.
 * @property {(id: string, action: string, note?: string) => Promise<string>} moderate
 *
 * @typedef {object} ProfileReader
 * @property {() => Promise<object | null>} getMe
 * @typedef {object} ProfileWriter
 * @property {(dto: object) => Promise<object>} update
 *
 * @typedef {object} RateLimiter
 * @property {(key: string, action: string, limit: number, windowSeconds: number) => Promise<boolean>} consume
 *   Returns true when the call is within the limit. Atomic and shared across instances (ADR-11).
 *
 * @typedef {{ userId: string, email: string }} VerifiedToken
 * @typedef {object} TokenVerifier
 * @property {(token: string) => Promise<VerifiedToken>} verify
 *   Throws AuthenticationError when the token is missing, malformed, expired or not signed by our project.
 *
 * @typedef {object} GuideSourceReader
 * @property {(slug: string) => Promise<object | null>} forCompany
 * @typedef {object} CompanyAdminWriter
 * @property {() => Promise<object[]>} listPending
 * @property {(slug: string, action: "approve" | "merge", mergeInto?: string) => Promise<string>} decide
 * @typedef {object} UpdateReviewWriter
 * @property {() => Promise<object[]>} list
 * @property {(id: string, approve: boolean, note?: string) => Promise<string>} decide
 * @typedef {object} ReportQueue
 * @property {(status: "open" | "actioned" | "dismissed") => Promise<object[]>} list
 * @property {(id: string) => Promise<string>} dismiss
 * @typedef {object} AdminPostWriter
 * @property {(p: AdminPostPayload) => Promise<string>} post
 *
 * @typedef {object} ScopedRepositories
 * Everything a request-scoped service may need, built once per request from the caller's token.
 * @property {ExperienceReader} experiences
 * @property {MyContentReader} mine
 * @property {AdminQueueReader} adminQueue
 * @property {CompanyReader} companies
 * @property {ExperienceWriter} experienceWriter
 * @property {InteractionWriter} interactions
 * @property {ReportWriter} reports
 * @property {ModerationWriter} moderation
 * @property {ProfileReader} profiles
 * @property {ProfileWriter} profileWriter
 * @property {GuideSourceReader} guideSources
 * @property {CompanyAdminWriter} companyAdmin
 * @property {UpdateReviewWriter} updateReview
 * @property {ReportQueue} reportQueue
 * @property {AdminPostWriter} adminPost
 *
 * @typedef {object} RepositoryFactory
 * @property {(viewer: object) => ScopedRepositories} for  Repositories that run as the caller (RLS applies), or as an anonymous reader.
 *
 * @typedef {{ system: string, prompt: string, schema: unknown }} LlmRequest
 * @typedef {{ data: unknown, model: string }} LlmResult
 * @typedef {object} LlmClient
 * Port for the language model. The Gemini adapter and the fallback decorator both implement it
 * (Liskov: both return parsed JSON or throw).
 * @property {(req: LlmRequest) => Promise<LlmResult>} generateJson
 *
 * @typedef {object} GuideRepository
 * The guide cache is system-owned, so this repository uses the service role (docs/design/08 section 8.6).
 * @property {(companyId: string) => Promise<object | null>} find
 * @property {(guide: object) => Promise<void>} save
 *
 * @typedef {object} AccountDeleter
 * Service-role port: removes the person's content, then the auth user (docs/design/08 section 8.6).
 * @property {(userId: string, keepLive: boolean) => Promise<object>} delete
 */
export {};
