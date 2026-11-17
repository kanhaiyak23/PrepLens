# PrepLens: Presentation and Viva Guide

How to explain the design tomorrow: what we built, why each decision was made, and where in the code to point. Everything here was checked against the real files. Longer proof lives in `docs/design/` (index in `docs/design/README.md`).

**One-line pitch:** PrepLens is a moderated archive of campus placement interview experiences written by seniors for juniors, plus an AI prep guide that cites only real experiences.

**Know the history before the viva:** the API started in TypeScript, was converted to plain JavaScript (ADR-27), and was converted back to TypeScript (ADR-30). Be ready to give the reason for the return: ports are now real `interface`s that the compiler enforces (`implements ExperienceReader`), so a renamed method or a changed signature fails the build instead of a test, and CI (ADR-32) runs `tsc` on every pull request. Zod still guards the runtime boundary; types guard the code between boundaries.

---

## 0. Suggested 20-minute running order

| Min | Topic | Where to point |
| --- | --- | --- |
| 0-2 | Problem, actors, scope, anti-goals | Section 1 |
| 2-5 | Architecture: two deployables, one shared contract, layers | Sections 2, 3 |
| 5-9 | Live walk of one request (submit an experience) | Section 4 |
| 9-14 | OOP, SOLID, design patterns with file names | Sections 5, 6, 7 |
| 14-17 | Database as the source of truth, security, concurrency | Sections 8, 9 |
| 17-19 | Frontend design | Section 10 |
| 19-20 | Testing, honest limits | Sections 11, 12 |

---

## 1. Requirements (docs/design/01-requirements.md)

- **Actors:** Visitor (read only), Student (`@nst.rishihood.edu.in` Google account: post, vote, bookmark, report), Admin (moderate). External: Google (OAuth), Gemini (LLM).
- **Functional groups:** Browse (FR-01..06), Identity (FR-10..12), Contribute (FR-20..26), Interact (FR-30..32), Moderate (FR-40..46).
- **Non-functional that drove the design:** privacy of anonymous posts (NFR-02), one vote per user even under concurrency (NFR-03), append-only audit log (NFR-04), reads survive Gemini outage (NFR-06), rate limits per user not per IP because campus Wi-Fi shares one IP (NFR-08), consent recorded before publishing (NFR-09), layered code (NFR-11).
- **Anti-goals:** not a job board, not a DSA site, not a forum (no comments), not a referral network. Say these; they show scope control.

---

## 2. System architecture

```
Browser ──► apps/web (Next.js 16, presentation only)
              │  Authorization: Bearer <Supabase access token>
              ▼
          apps/api (Express 5, TypeScript)  ──► Supabase Postgres (RLS + SQL functions + triggers)
              │                                  Supabase Auth (Google OAuth)
              └──► Gemini (only from the API)
packages/shared  ──► Zod schemas, enums, DTO types, error codes (used by web AND api)
```

| Decision | ADR | Concept | One-sentence reason |
| --- | --- | --- | --- |
| Separate Express API owns all business logic | ADR-21 | Single trust boundary, separation of concerns | The web app holds no secrets and no rules; the service-role key lives only in the API |
| Monorepo with shared contract package | ADR-24 | Single source of truth, contract-first | Web and API cannot disagree about a field name or enum |
| Supabase issues the token, API verifies it | ADR-22 | Don't roll your own auth | Role is read from the DB on every request, never from the browser |
| User-scoped DB client per request; service role only for named tasks | ADR-23 | Least privilege | RLS applies to the caller; service role used only for rate limiter, guide cache, account deletion |
| Postgres, not MongoDB | ADR-02 | Integrity belongs in the database | Votes, bookmarks, consent, audit log need constraints that cannot be raced |

Where: `apps/api/src/app.ts` (helmet, CORS to one origin never `*`, 100 kb JSON limit, error handler last), `apps/api/src/container.ts`.

---

## 3. Backend layers (ADR-01)

```
routes/index.ts            URL + middleware chain per route
controllers/*.ts           parse req.valid, call ONE service method, shape response. No rules.
services/*.ts              application logic, depends on ports only
domain/                    ports.ts, errors.ts, Submission.ts, ModerationCommand.ts, model/*, guide/CompanyGuide.ts
infrastructure/            Supabase adapters, GeminiClient, FallbackLlmClient, PostgresRateLimiter
container.ts               composition root: the only file that names concrete classes
```

Dependencies point inward: services import `domain/`, never `infrastructure/`. Quick proof (compliance audit, `docs/design/10-compliance.md`): grep for `supabase` inside `services/` returns nothing.

**Request pipeline (read** `routes/index.ts` **top to bottom):**`authenticate` → `requireRole` → `rateLimit` → `validate` (Zod) → controller → service → repository → DB. Example, line 36: `r.post("/experiences", ...signedIn, rateLimit(c,"submit",5,DAY), validate({body: submissionSchema}), experiences.submit)`.

Middleware files in `apps/api/src/middleware/`:

- `authenticate.ts`: verifies the bearer token, loads role from DB, builds `req.ctx = {requestId, viewer, services}`. An invalid token is an error, never a silent downgrade to visitor.
- `validate.ts`: "parse, don't validate" (ADR-16). Unknown keys (like a client-sent `role`) are stripped.
- `rateLimit.ts`: key is `u:<userId>` for signed-in users, hashed IP for visitors (ADR-11). State in Postgres (`check_rate_limit` RPC) so every instance shares counters.
- `cache.ts`: `publicCache` for identical-for-everyone reads, `noStore` for private, `cacheUnlessSignedIn` for a post whose view differs for its author (ADR-09).
- `errorHandler.ts`: one error envelope `{error:{code,message,fields?}, requestId}` (ADR-19). Unknown errors become a generic 500; detail only in logs.

---

## 4. Walk one request end to end: "Submit an experience"

1. **Web** `components/app/SubmitForm.tsx` shows the consent sentence directly above the button and calls `api("/api/v1/experiences", {token, method:"POST", body})` (`lib/api.ts`).
2. **Route** passes authenticate (token verified by `SupabaseTokenVerifier`), `rateLimit` 5/day, `validate` with `submissionSchema` (a Zod `discriminatedUnion("mode")`: quick or detailed; `consent` must be literal `true`).
3. **Controller** `ExperienceController.submit` calls `req.ctx.services.submissions.submit(req.valid.body)` and returns 201.
4. **Service** `SubmissionService` asks `SubmissionFactory.create(dto)` for a `QuickSubmission` or `DetailedSubmission`, calls `toPayload()` (Template Method), then `experienceWriter.submit(payload)`.
5. **Repository** `SupabaseExperienceWriter` (in `infrastructure/supabase/SupabaseWriters.ts`) calls one SQL function (RPC) that inserts the experience, rounds, and questions in **one transaction** (ADR-14). Unknown company becomes a `pending` company; author batch/branch are snapshotted.
6. **Database** enforces: consent constraint, status transition trigger `guard_experience`, RLS. Post starts `pending`; admin approves later.
7. Errors from the DB come back as `CODE: message` and `fromDbError` (`domain/errors.ts`) turns them into the right `AppError` once.

Practice saying this chain from memory; it demonstrates every layer.

---

## 5. OOP pillars: where each is applied

| Pillar | Example | File |
| --- | --- | --- |
| **Abstraction** | Ports hide Supabase/Gemini/Postgres: `ExperienceReader`, `ExperienceWriter`, `LlmClient`, `RateLimiter` | `apps/api/src/domain/ports.ts` |
| **Encapsulation** | `AnonymousAuthor` can only serialise to `{anonymous, batch}`; `CompanyGuide` owns `isStale()`, `citesOnly()`, `toView()`; `FeedSort` hides cursor encoding | `domain/model/AuthorVisibility.ts`, `domain/guide/CompanyGuide.ts`, `domain/model/FeedSort.ts` |
| **Inheritance** | `Submission` → `QuickSubmission`, `DetailedSubmission`; `AppError` → 8 error subclasses; `FeedSort` → `NewestFirst`, `InterviewDateFirst`; `AuthorVisibility` → `AnonymousAuthor`, `NamedAuthor` | `domain/Submission.ts`, `domain/errors.ts`, `FeedSort.ts`, `AuthorVisibility.ts` |
| **Polymorphism** | `cmd.run(writer)` works for every `ModerationCommand`; `AuthorVisibility.toPublic()`; `sort.after()/nextCursor()`; any `LlmClient` | `domain/ModerationCommand.ts`, `ModerationService.ts:17` |

Composition over inheritance elsewhere: `buildServices` in `container.ts` composes each service from small collaborators via constructors.

**Honest limit to state:** the entities (Experience, Profile, Vote...) are database tables, not TypeScript classes, on purpose (ADR-25): the rules must hold even if the API is bypassed, so a TypeScript copy would be a second source of truth. TypeScript/JS classes exist only where behaviour needs to live in code.

---

## 6. SOLID with exact locations

**S: Single Responsibility**

- Controllers only translate HTTP ↔ service (`controllers/ExperienceController.ts`).
- `ModerationService` runs commands; each `*Command` knows one decision.
- `GuideService` orchestrates; prompt building, grounding, stats, fingerprint are separate functions in `domain/guide/CompanyGuide.ts` (`buildPrompt`, `groundContent`, `computeStats`, `fingerprintOf`).
- Web: `ExperienceCard.tsx` renders one card and knows nothing about fetching; `AdminRow.tsx` is the one layout for every admin list.

**O: Open/Closed**

- New moderation decision = new `Command` class + one factory case; `ModerationService.execute` untouched.
- New feed order = new `FeedSort` subclass (`FeedSort.ts`); this is how the "Sort by interview date" feature was added (migration `0010`).
- Web: new outcome or status = one entry in `OUTCOME_TONE` / `STATUS_TONE` (`lib/format.ts`); new button look = one entry in `VARIANT` (`components/ui/Button.tsx`).

**L: Liskov**

- `QuickSubmission` and `DetailedSubmission` both return ≥1 valid round; `SubmissionService` treats them identically.
- `FallbackLlmClient` is substitutable for `GeminiClient`: `GuideService` cannot tell them apart.
- `AnonymousAuthor` never leaks id/email/branch, so it is safely substitutable for `NamedAuthor` in any serialiser (covered by payload tests).

**I: Interface Segregation**

- Ports are split by purpose in `ports.ts`: `ExperienceReader` (read only), `ExperienceWriter`, `InteractionWriter`, `ModerationWriter` (one method), `RateLimiter` (one method: `consume`). The moderation log has **no** update/delete method at all.

**D: Dependency Inversion**

- Services import ports (`domain/`), adapters implement them, `container.ts` wires them. Tests build the same services with in-memory fakes (`tests/fakes.ts`), so 116 API tests run with no database.
- Web: components depend on the `useMe()` hook and the `api()` function, not on URLs and `fetch` (`hooks/useMe.ts`, `lib/api.ts`).

---

## 7. Design patterns: what, why, where

| Pattern | Class / file | Problem it solves here |
| --- | --- | --- |
| **Ports and Adapters (Layered)** | `domain/ports.ts`, `infrastructure/` | Rules independent of Supabase, Express, Gemini; testable with fakes |
| **Repository** | SupabaseExperienceReader, `SupabaseReaders.ts` (list reads), `SupabaseWriters.ts`, `SupabaseAdminWriters.ts` | All persistence knowledge in one place; DB errors translated once (`fromDbError`) |
| **Adapter** | `GeminiClient.ts`, `SupabaseTokenVerifier.ts` | Vendor shapes and vendor error text stop at one class (a real bug: "API key not valid" used to reach clients) |
| **Decorator** | `FallbackLlmClient.ts` | Free-tier model returns 429/5xx: try next model without changing `GuideService`. 400 is not retried |
| **Factory** | `SubmissionFactory`, `ModerationCommandFactory`, `FeedSorts.create`, `AuthorVisibilityFactory.fromDb`, `SupabaseRepositoryFactory.for(viewer)` | Callers never name a concrete class; one place makes the choice. `fromDb` **fails closed**: anything not `anonymous:false` is anonymous |
| **Composition Root** | `container.ts` (`createContainer`, `buildServices`) | Only file that knows concrete classes; no singletons or globals |
| **Template Method** | `Submission.toPayload()`; `FeedSort.nextCursor/after` | Fixed algorithm, one varying step (`normaliseRounds`, `keyOf`/`resume`) |
| **Strategy** | `FeedSort` with `NewestFirst`, `InterviewDateFirst` | Interchangeable orderings; cursor carries the sort name so a cursor from another order is rejected |
| **Command** | `ModerationCommand.ts` (`Approve`, `Reject`, `Remove`, `Reinstate`) | Each decision is an object; `RejectCommand` fails fast without a note. Audit row written in the same DB transaction |
| **State** | `ExperienceLifecycle.ts` + trigger `guard_experience` | pending → published/rejected/unpublished etc. A test reads the SQL and fails if the TS table and the SQL table differ |
| **Polymorphism instead of a flag** | `AuthorVisibility.ts` | Privacy gate: `if (isAnonymous) hide()` would leak the one time it is forgotten |

**Patterns deliberately rejected (say these, it shows judgment):**

- **Singleton**: a shared Supabase client would carry one user's token and run another user's query as them.
- **Observer**: no in-process fan-out needed; guide staleness uses a fingerprint, counters use DB triggers, the audit row uses the command's transaction. In-process events are lost on a serverless restart.
- **Builder, Visitor, Mediator, Flyweight, Abstract Factory**: no problem here that they solve.
- **Chain of Responsibility**: Express middleware *is* this; we use it but did not design it, so we do not claim it.

---

## 8. Database design (docs/design/08-database-schema.md, `supabase/migrations/0001..0012`)

Tables: `profiles`, `admin_emails`, `companies`, `experiences`, `interview_rounds`, `questions`, `votes`, `bookmarks`, `reports`, `moderation_logs`, `company_guides`, `rate_limits`.

**Rules enforced by the database (not by app code), with the proof to cite:**

| Rule | Mechanism | ADR |
| --- | --- | --- |
| Only `nst.rishihood.edu.in` can sign up | Trigger `enforce_college_domain` on `auth.users`; exact match after last `@`, so `...edu.in.evil.com` fails | ADR-05 |
| One vote/bookmark per user per post, even under double-tap | Primary key `(user_id, experience_id)` + `ON CONFLICT DO NOTHING`; PUT/DELETE are idempotent | ADR-07 |
| Vote counter never drifts | Trigger `sync_upvote_count` in the same transaction | ADR-07 |
| Cannot publish without consent | CHECK on `consented_at` | ADR-18 |
| Only legal status changes | Trigger `guard_experience` (state machine) | ADR-15 |
| Moderation log cannot be edited or deleted | Trigger `moderation_logs_immutable` + RLS | ADR-10 |
| Anonymous author not recoverable | Public reads go through functions that omit identity columns; author batch/branch snapshotted at submit time | ADR-06 |
| Multi-table writes are atomic | Security-definer SQL functions (RPC); tables themselves stay closed | ADR-14, ADR-25 |
| Pagination is stable | Keyset (cursor) on `(created_at, id)`, fetch `limit+1` to know `hasMore`; never offset | ADR-08 |
| Search | Postgres full-text `tsvector` | ADR-17 |

**Defence in depth (ADR-04), the sentence to memorise:** an admin action is checked three times: the route (`requireRole`), the service (`ModerationService.assertAdmin`), and the database function. Removing any one still leaves the others.

Tests: `supabase/tests/001..006_*.sql` (rules as anon, student, other student, admin; query plans use indexes; sort; allowlist). See `supabase/tests/README.md`.

---

## 9. Errors and concurrency (docs/design/09-errors-and-concurrency.md)

**Error taxonomy** (`apps/api/src/domain/errors.ts`): `AppError` base with `code` + `httpStatus`; `ValidationError` 400, `AuthenticationError` 401, `ForbiddenError` 403, `NotFoundError` 404 (never reveals a hidden post exists), `ConflictError` 409, `RateLimitedError` 429, `NotEnoughDataError` 409, `UpstreamError` 503. Same codes in `packages/shared/src/enums.ts` (`ERROR_CODES`), so the web app switches on codes.

**Four validation layers:** browser (UX only, never trusted) → Zod in `validate.ts` → domain methods → DB constraints.

**Concurrency table (cite one per defence, each has a test):**

| Race | Defence | Concept |
| --- | --- | --- |
| Double-tap vote | PK + `ON CONFLICT` | Constraint beats check-then-act |
| Two admins approve/reject the same post | `UPDATE ... WHERE status='pending'`; 0 rows → `ConflictError` | Optimistic concurrency (compare-and-set) |
| Two students add the same new company | Unique slug; loser re-reads | Unique constraint as arbiter |
| Crash mid-submission | One transaction in an RPC | Atomicity (ACID) |
| Many requests regenerate the same AI guide | Upsert on unique `company_id` | Idempotent write |
| Rate limit across instances | Atomic upsert counter in Postgres | Shared state |

A concurrency check against a running stack: `apps/api/scripts/concurrency-check.mjs`.

**AI guide (ADR-12), a favourite viva topic.** `GuideService.getGuide`:

1. Needs ≥ 3 published experiences, else `NotEnoughDataError`.
2. `fingerprintOf` = hash of source ids + update times; cached guide reused if the fingerprint matches (no write-path hooks needed to invalidate).
3. Prompt says "use ONLY the numbered experiences"; Gemini returns JSON validated by `guideSchema`.
4. `groundContent` drops citations that point at nothing real and drops any round/tip left with no citation.
5. Counts and top topics are **computed in code** (`computeStats`), never generated by the model.
6. If Gemini fails, a cached guide is shown only if everything it cites is still published (`citesOnly`); otherwise 503 for the guide panel only; the rest of the site is unaffected (NFR-06).

---

## 10. Frontend design (apps/web, Next.js 16 App Router, TypeScript, Tailwind 4)

**Rule: presentation only.** No business rules, no service-role key. Every rule lives in the API or DB.

| Concern | Decision | Where |
| --- | --- | --- |
| Rendering | Server Components for data-heavy public pages (SEO, small bundle); Client Components only for interactivity (ADR-13) | `app/archive/page.tsx`, `app/experience/[id]/page.tsx` (Server); `SubmitForm.tsx`, `Filters.tsx`, `ExperienceActions.tsx`, `AdminConsole.tsx` (Client) |
| Server → API | Public reads without a token, so server pages show only what a visitor may see | `lib/serverApi.ts` (`import "server-only"`) |
| Client → API | One thin client attaching the bearer token; maps the error envelope to `ApiError` with `code`, `requestId`, `fields` | `lib/api.ts` |
| Auth | `@supabase/ssr` browser client; `useAuth` (session, `loading` flag so UI never flashes wrong state); `useMe` (profile, one hook instead of five copies of the same fetch); `proxy.ts` only refreshes the session, it does **no** authorisation | `hooks/useAuth.ts`, `hooks/useMe.ts`, `src/proxy.ts`, `app/auth/callback/route.ts` |
| Open-redirect protection | After login only same-site relative paths allowed | `lib/safeNext.ts` |
| Design system (ADR-28) | Tokens in one place (`@theme` in `globals.css`); UI primitives `components/ui/` (Button, Badge, Notice, Tabs, Segmented, EmptyState, Icon); layout `PageShell`, `AppHeader`, `AppFooter` | `globals.css`, `components/ui/*`, `components/app/PageShell.tsx` |
| Lookup tables instead of if/else | `VARIANT` (Button), `TONE` (Badge), `OUTCOME_TONE`, `STATUS_TONE`, `OUTCOME_LABEL` | `components/ui/*`, `lib/format.ts` |
| Pure presentational components | `ExperienceCard`, `ExperienceView` take props, never fetch | `components/app/` |
| Shared contract | Types and enums imported from `@preplens/shared` (no duplicated types) | everywhere |
| Privacy in UI | `authorLabel()` renders `Anonymous · <batch>`; the API never sends more, so there is nothing to hide client-side | `lib/format.ts` |
| Honest UI rule | No fake numbers; empty states designed instead (a deliberate difference from the Stitch mock, ADR-28) | `EmptyState.tsx` |

**Frontend principles by name:**

- SRP: `AdminRow` (one layout for queue, edits, reports, companies).
- OCP: tone/variant tables.
- DIP: components depend on `useMe`/`api`, not `fetch` and URLs.
- DRY: `useMe`, `AdminRow`, `buttonClass`.
- Why no service/repository layer in the web app: the API already is that layer; a second one would be indirection with no problem to solve (rejected in ADR-28).

---

## 11. Testing and evidence

- **API:** 130 tests, Vitest + supertest against `createApp()` (imported without listening), in-memory fakes, no database. `npm test` at the repo root builds shared then runs them.
- **Database:** repeatable SQL tests in `supabase/tests/` (RLS per role, anonymity, one vote per user, append-only log, domain restriction, query plans).
- **Model parity:** `model.test.ts`-style test reads the SQL transition table and compares it to `TRANSITIONS` in `ExperienceLifecycle.ts`.
- **Live checks:** concurrency script, real Supabase smoke test, Gemini verified live with `gemini-2.5-flash`.
- **Rule:** each concurrency or privacy claim has a test that fails when its defence is removed. Be ready to demo: fire the same vote twice, count stays 1.
- **Design compliance audit:** `docs/design/10-compliance.md` (layering greps, service-role usage, class-diagram coverage, known gaps). Re-run before the evaluation.

---

## 12. Honest limits (examiners respect these)

- Not built, on purpose or for time: `Idempotency-Key` on submit (rate limit of 5/day is the mitigation); API latency measurement (NFR-05: only database query plans are checked); screen-reader pass (NFR-10); a mutation test proving each concurrency defence fails when removed.
- Ports are TypeScript interfaces, so `tsc` refuses an adapter that misses a method; `apps/api/tests/ports.test.ts` additionally keeps the small ports small (Interface Segregation).

- The API went JavaScript (ADR-27) and back to TypeScript (ADR-30): the decision record keeps both, with reasons.
- Entities are tables, not classes (ADR-25).
- Scale target is hundreds of users, thousands of rows; the ladder to more is documented in ADR-20 (cache, read replicas, queue for AI).
- Free-tier hosting: API may cold-start; Gemini free tier is rate limited (hence the decorator).
- `ADR-26`: two non-college test addresses are allowed beside the domain rule; **remove before real launch**.
- No motion/animation in the final design (the Stitch design has none); motion plan is on hold.

---

## 13. Likely viva questions with short answers

 1. **Why a separate Express API instead of Next.js server actions?** One trust boundary, secrets only in the API, API reusable by any client, testable without a browser (ADR-21).
 2. **Why Postgres and not MongoDB?** The integrity rules (unique vote, consent, append-only log, state machine) belong in constraints that cannot be bypassed (ADR-02).
 3. **How do you keep anonymous authors anonymous?** Three gates: DB functions omit identity columns; `AuthorVisibilityFactory` fails closed and `AnonymousAuthor` can only emit `{anonymous,batch}`; the UI only renders what arrives (ADR-06).
 4. **What stops a non-college email signing in?** A DB trigger on `auth.users`, comparing the exact domain; the frontend is not trusted (ADR-05).
 5. **Why keyset pagination?** Offset skips/duplicates rows when data changes and gets slower with depth; keyset on `(created_at, id)` is stable and uses the index (ADR-08).
 6. **How do you stop the AI hallucinating?** Grounding: numbered sources only, citations validated and dropped if invalid, stats computed in code, nothing cached on malformed output (ADR-12).
 7. **What if Gemini is down?** Only the guide panel degrades; fallback decorator tries other models; stale guide shown only if all its citations are still published.
 8. **Where is the Strategy pattern?** `FeedSort` (`NewestFirst`, `InterviewDateFirst`). **Command?** `ModerationCommand`. **Decorator?** `FallbackLlmClient`. **Factory?** five factories listed in section 7.
 9. **Why no Singleton?** The user-scoped Supabase client carries a token; sharing it would cross users.
10. **How is rate limiting fair on campus Wi-Fi?** Keyed on user id for signed-in actions; only visitors fall back to hashed IP with a higher limit (ADR-11).
11. **Two admins click approve and reject at once?** Compare-and-set UPDATE on `status='pending'`; the loser gets 409 `CONFLICT`.
12. **Why does the client never send** `role`**?** The API derives identity from the verified token and the role from the database on every request (`middleware/authenticate.ts`).
13. **What is the difference between validation layers?** Browser = UX, Zod = shape, domain = business rule, DB = last line of defence.
14. **Where is the Open/Closed principle visible on the frontend?** `VARIANT`, `TONE`, `OUTCOME_TONE` lookup tables: a new look is a new entry, not an edit.

---

## 14. Where to read more (in this order)

1. `docs/design/02-decisions.md`: ADR-01..28, each with Problem, Decision, Why, Rejected.
2. `docs/design/04-oop-and-solid.md` and `05-design-patterns.md`: diagrams per pattern.
3. `docs/design/06-sequence-and-activity.md`: sequence/state diagrams (submit, moderate, guide).
4. `docs/design/07-api-design.md` and `08-database-schema.md`: contracts and schema.
5. `docs/design/10-compliance.md`: audit, including known gaps.
6. Code entry points: `apps/api/src/container.ts`, `routes/index.ts`, `domain/`, `apps/web/src/lib/`, `components/ui/`.