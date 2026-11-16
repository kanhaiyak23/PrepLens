# 7. API and Interface Design

## 7.1 Layer contract (ADR-01, ADR-21)

Two deployables in one monorepo (ADR-24): `apps/api` (Node.js + Express, TypeScript) owns every rule; `apps/web` (Next.js) only renders and calls the API. `packages/shared` holds the Zod schemas and types both use.

| Layer | Contains | May depend on | Must not |
|---|---|---|---|
| Presentation (API) | Express routes, controllers, middleware (`apps/api`) | Application services, shared Zod schemas | Contain business rules or SQL |
| Presentation (UI) | Next.js pages and client components (`apps/web`) | The API over HTTP, shared types | Contain business rules, SQL or the service-role key |
| Application | `*Service` classes, DTOs, `ModerationCommand`s | Domain interfaces | Import Express or Supabase |
| Domain | Entities, value objects, policies, repository and port interfaces, `AppError` | Nothing outside the domain | Know about HTTP, SQL or vendors |
| Infrastructure | `Supabase*Repository`, `GeminiClient`, `PostgresRateLimiter`, composition root | Domain interfaces, vendor SDKs | Contain business rules |

Dependency direction: Presentation → Application → Domain ← Infrastructure. The web app depends on the API's HTTP contract, never on its internals.

### API folder layout (PLANNED, created in Phase 2/3)

```
apps/api/src/
  routes/            one router per resource, wires middleware + controller
  controllers/       parse, call one service, map result/errors
  middleware/        requestId, authenticate, requireRole, rateLimit, validate, errorHandler
  services/          application layer
  domain/            entities, commands, policies, interfaces, errors
  repositories/      Supabase implementations of domain interfaces
  infrastructure/    GeminiClient, FallbackLlmClient, PostgresRateLimiter
  container.js       composition root
  app.js, server.js  Express app vs process start (so tests import app without listening)
```

## 7.2 Controller responsibilities (all controllers do exactly this)

1. Resolve the viewer from the verified bearer token (ADR-22), never from the request body.
2. Parse input with the operation's Zod schema.
3. Call one service method.
4. Map the result, or any `AppError`, to the response envelope.

## 7.3 Service method signatures (TypeScript)

```ts
interface Viewer { userId: UUID | null; role: 'visitor' | 'student' | 'admin' }

// ExperienceService
getFeed(q: FeedQuery): Promise<Page<PublicExperienceCard>>
getById(id: UUID, viewer: Viewer): Promise<PublicExperience>          // throws NotFoundError
unpublish(id: UUID, viewer: Viewer): Promise<void>                    // owner only
republish(id: UUID, viewer: Viewer): Promise<void>

// SubmissionService
submit(dto: SubmissionDto, author: Profile): Promise<SubmitResult>    // throws ValidationError, RateLimitedError
proposeEdit(id: UUID, dto: EditDto, author: Profile): Promise<void>
proposeResultUpdate(id: UUID, dto: ResultUpdateDto, author: Profile): Promise<void>

// InteractionService
vote(exp: UUID, user: UUID): Promise<void>                            // idempotent
unvote(exp: UUID, user: UUID): Promise<void>
bookmark(exp: UUID, user: UUID): Promise<void>
stateFor(ids: UUID[], user: UUID): Promise<InteractionState>

// ModerationService
execute(cmd: ModerationCommand): Promise<ModerationResult>            // admin only; throws ForbiddenError, ConflictError

// GuideService
getGuide(companySlug: string): Promise<GuideView>                     // throws NotEnoughDataError, LlmUnavailableError

// AccountService
deleteAccount(user: UUID, posts: 'delete' | 'keep'): Promise<void>
```

## 7.4 Endpoint contracts

Base path `/api/v1`. All responses use the envelope in 7.5. Auth column: `none`, `optional` (viewer-dependent), `student`, `owner` (author of the post), `admin`. Rate limits as in ADR-11.

**Middleware order on every request:** requestId → helmet → CORS (explicit web origin) → JSON body limit → authenticate (optional or required) → rateLimit → validate (Zod) → controller → errorHandler.

| Operation | Method and path | Auth | Cache | Request | Success | Errors |
|---|---|---|---|---|---|---|
| List experiences | `GET /experiences` | none | public, `s-maxage=60, stale-while-revalidate=300` | query: `company?, role?, outcome?, year?, campus?, q?, sort?, cursor?, limit<=50` | `200 { data: Card[], page: { nextCursor, hasMore } }` | 400 |
| Get experience | `GET /experiences/{id}` | optional | public for published, `no-store` for owner/admin view | | `200 { data: Experience }` | 404 |
| Company list | `GET /companies` | none | public, long TTL | | `200 { data: CompanySummary[] }` | |
| Company autocomplete | `GET /companies/autocomplete?prefix=` | none | public | `prefix` 1 to 40 chars | `200 { data: CompanySummary[] }` | 400 |
| Company guide | `GET /companies/{slug}/guide` | none | server cache by fingerprint | | `200 { data: Guide, meta: { generatedAt, sourceCount } }` | 404, 409, 429, 503 |
| Archive stats | `GET /stats` | none | public, 5 min | | `200 { data: { published, companies } }` | |
| My profile | `GET /me` / `PATCH /me` | student | `no-store` | `PATCH`: `{ graduationBatch, branch }` | `200 { data: Profile }` | 400, 401 |
| My experiences | `GET /me/experiences` | student | `no-store` | cursor | `200 { data: Experience[], page }` | 401 |
| My bookmarks | `GET /me/bookmarks` | student | `no-store` | cursor | `200 { data: Card[], page }` | 401 |
| My interaction state | `GET /me/interactions?ids=a,b,c` | student | `no-store` | up to 50 ids | `200 { data: { voted: UUID[], bookmarked: UUID[] } }` | 401 |
| Delete account | `DELETE /me?posts=keep\|delete` | student (not admin) | none | `posts` required | `204` | 400, 403 |
| Submit | `POST /experiences` | student | none | `SubmissionDto` | `201 { data: { id, status: 'pending' } }` | 400, 401, 403, 429 |
| Edit / result update | `PATCH /experiences/{id}` | owner | none | `EditDto` | `202 { data: { status } }` | 400, 403, 404, 409 |
| Withdraw | `POST /experiences/{id}/unpublish` | owner | none | | `200 { data: { status: 'unpublished' } }` | 403, 404 |
| Republish | `POST /experiences/{id}/republish` | owner | none | | `200 { data: { status: 'pending' } }` | 403, 404, 409 |
| Vote / unvote | `PUT` / `DELETE /experiences/{id}/vote` | student | none | | `200 { data: { voted, upvoteCount } }` | 401, 404, 429 |
| Bookmark | `PUT` / `DELETE /experiences/{id}/bookmark` | student | none | | `200 { data: { bookmarked } }` | 401, 404, 429 |
| Report | `POST /experiences/{id}/reports` | student | none | `{ reason, note? }` | `201 { data: { id } }` | 400, 401, 409 duplicate, 429 |
| Admin queue | `GET /admin/experiences?status=pending\|removed\|updates` | admin | `no-store` | cursor | `200 { data, page }` | 403 |
| Admin decision | `POST /admin/experiences/{id}/{approve\|reject\|remove\|reinstate}` | admin | none | `{ note? }` (required for reject) | `200 { data: { status } }` | 400, 403, 404, 409 already decided |
| Update decision | `POST /admin/experiences/{id}/update/{approve\|reject}` | admin | none | `{ note? }` | `200` | 403, 404, 409 |
| Report decision | `POST /admin/reports/{id}/{dismiss\|action}` | admin | none | | `200` | 403, 404, 409 |
| Company admin | `POST /admin/companies/{slug}/{approve\|reject\|merge}` | admin | none | `{ mergeInto? }` | `200 { data: Company }` | 400, 403, 404, 409 |
| Post on behalf | `POST /admin/experiences` | admin | none | `SubmissionDto` + `authorName`, `consent` | `201` | 400, 403 |
| Health | `GET /healthz` | none | no-store | | `200 { status, uptime, version }` | |

Idempotency: `PUT`/`DELETE` on vote and bookmark are idempotent by design (ADR-07). `POST /experiences` has **no** `Idempotency-Key` yet: the 5-per-day limit bounds a double submit, and a content-hash guard is a planned addition (see `09`).

As built: the quick form's free text is stored as one "Overview" round (tips column, max 4000 chars). `/me/bookmarks`, `/admin/experiences` and `/companies` exist; every endpoint in this table now exists, plus `PATCH /experiences/{id}` (202 when queued for review, 200 when applied), `DELETE /experiences/{id}/update`, `DELETE /me?posts=keep|delete`, `GET /admin/updates`, `POST /admin/experiences/{id}/update/{approve|reject}`, `GET /admin/reports`, `POST /admin/reports/{id}/dismiss`, `POST /admin/experiences` (post on behalf), `GET /admin/companies/pending`, `POST /admin/companies/{slug}/{approve|merge}`, `GET /companies/{slug}/guide`.

## 7.5 Response and error envelope (ADR-19)

```json
// success
{ "data": { }, "page": { "nextCursor": "string|null", "hasMore": true } }

// error
{
  "error": { "code": "VALIDATION_FAILED", "message": "Company is required.", "fields": { "company": "required" } },
  "requestId": "01JB7Q2K9X"
}
```

Stable error codes: `VALIDATION_FAILED`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `NOT_ENOUGH_DATA`, `UPSTREAM_UNAVAILABLE`, `INTERNAL`.

## 7.6 DTO shapes (Zod is the source of truth; these are indicative)

```ts
type SubmissionDto = {
  mode: 'quick' | 'detailed'
  company: string                     // resolved server-side by slug or alias
  role: string
  driveType: 'on-campus' | 'off-campus' | 'referral'
  interviewYear: number               // not in the future
  interviewMonth?: number
  outcome: 'selected' | 'rejected' | 'in-process' | 'withdrew'
  isAnonymous: boolean
  consent: true                       // literal true; anything else is invalid
  freeText?: string                   // quick mode
  rounds?: { name: string; tips?: string; questions: { text: string; topic?: string }[] }[]  // detailed mode
}
// Deliberately absent: userId, role, status, authorBatch, authorBranch, upvoteCount.
// If a client sends them they are ignored (and a test proves they change nothing).
```

## 7.7 Pagination contract

Cursor is an opaque base64 string of `(sortKey, id)`. Clients never construct one. An invalid cursor is a 400, never a silent restart.
