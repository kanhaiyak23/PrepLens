# 10. Design Compliance Audit

Purpose: check the code against the rules in `02-decisions.md`, `03` to `09`, and say plainly where we follow them, where we do not, and why.
Status is evidence-based. "Evidence" names a test, a command, or a file. Audit date: 2026-11-10 (updated after the remaining features were built).

Legend: **Yes** = built and evidenced. **Partly** = built, with a stated gap. **No** = designed, not built. **Changed** = we deliberately did something different and updated the doc.

## 10.1 Architecture decisions

| ADR | Rule | Status | Evidence / gap |
|---|---|---|---|
| 01 Layers and ports | Controller, service, domain, infrastructure; domain imports nothing outward | **Yes** | Audit grep: `services/` and `controllers/` import no Supabase, Express or infrastructure. **Violation found and fixed**: `domain/context.js` imported services; moved to `src/context.js` |
| 02 Relational DB | Integrity in the database | **Yes** | FKs, CHECKs, unique keys in migrations 0001 to 0008 |
| 03 Rounds as tables | `interview_rounds`, `questions` with `(parent, position)` unique | **Yes** | `0001_schema.sql` |
| 04 RLS plus server authz | Defence in depth | **Yes** | Tables closed to anon and authenticated (`supabase/tests/001_rules.sql` §10). Admin checked at route, service and DB for moderation and company admin |
| 05 Domain rule in DB | Exact `@nst.rishihood.edu.in` | **Yes** | `001_rules.sql` §1: gmail, `…edu.in.evil.com` and `nst…edu.in@gmail.com` rejected. Real Google sign-in verified with the admin account |
| 06 Anonymity by data shape | Public payload has batch only | **Yes** | `001_rules.sql` §6; `units.test.js` mapper test; `guide.test.js` sources test; verified in the browser as a visitor |
| 07 Votes by constraint | PK is the rule | **Yes** | `001_rules.sql` §7; API test "double PUT leaves one vote"; UI check count 1, 0, 1 |
| 08 Keyset pagination | `(created_at, id)` cursor | **Yes** | API test walks pages with no repeat or skip; `003_query_plans.sql` |
| 09 Public cache vs per-user state | Cacheable responses identical for all | **Yes** | Header tests: list public, detail `private, no-store` when a token is sent, interactions `no-store`, guide public |
| 10 Append-only log | No UPDATE or DELETE | **Yes** | `001_rules.sql` §8. Only FK null-out is allowed, so deleting a post keeps its log rows |
| 11 Postgres rate limit by user | 5 submit/day, 10 report/day, 60 interact/min, guide 20 user and 200 visitor per 10 min | **Yes** | API tests per route; `001_rules.sql` §9 (5 of 7 allowed). Gap: public GET list and detail are not limited (only the guide is) |
| 12 AI guide | Grounded, cached, degradable | **Yes (unit and live)** | `guide.test.js` plus a live run against Gemini (`gemini-2.5-flash`, about 6.5 s first call, cached call skips the model): citations map to real posts, changing a post regenerates, with the model down a stale guide is served only while every cited post is still published and a withdrawn cited post makes it 503, vendor error text never reaches a client. Found and fixed during the live run: the Gemini message "API key not valid" was being returned to clients, and a retired model id (404) did not fall back |
| 13 Server Components default | Server render public pages | **Yes** | `/archive`, `/experience/[id]`, `/company/[slug]` render on the server; client components only for interaction |
| 14 Atomic writes | One transaction per write | **Yes** | `submit_experience`, moderation, company merge are single DB functions |
| 15 Status as a state machine | Legal transitions enforced | **Yes** | Enforced in the database trigger (`guard_experience`); described in TypeScript by `ExperienceLifecycle` (`TRANSITIONS`, `canMove`, `actionsFor`), which also drives the buttons on the experience page; a test reads the SQL and fails if the two tables differ. An edit to a live post is a queued proposal, never an in-place change (`supabase/tests/004`). **No TypeScript `Experience` entity** with `publish()`/`remove()` methods as drawn in `03`; see 10.3 |
| 16 Validate at every boundary | Zod, then DB CHECKs | **Yes** | Shared Zod schemas; API tests for strip, consent, future year; DB tests for the same rules |
| 17 Search | Postgres FTS, weighted | **Yes** | `search_tsv` weights A to D; verified by searching "linked" in the UI |
| 18 Consent as data | CHECK constraint | **Yes** | `published_requires_consent`; consent literal `true` in the schema |
| 19 One error envelope | Typed errors, request id | **Yes** | `AppError` hierarchy, `fromDbError`, tests for 400/401/403/404/409/429/503 |
| 20 Scale ladder | Documented triggers | **Yes** | In `02`; nothing built beyond need |
| 21 Express API owns rules | Next.js is presentation only | **Yes** | `apps/web` has no business rules and no service-role key |
| 22 Bearer-token auth | Verify token, role from DB | **Yes** | Tests: invalid or malformed token is 401 (never a silent visitor); client `x-user-id` and `x-role` ignored |
| 23 User-scoped DB by default | Service role only for a short list | **Yes** | Audit grep: `createServiceClient` is used only in `container.js`, for the rate limiter and the guide cache (both on the allowed list in `08` §8.6) |
| 24 Monorepo with shared schemas | One contract | **Yes** | `packages/shared` used by API and web |
| 25 Functions, tables closed | Security-definer functions | **Yes** | Advisor shows only the intended functions |

## 10.2 SOLID

| Principle | Status | Where it is real |
|---|---|---|
| S | **Yes** | One job per class: `SubmissionService` (orchestrate), `Submission` (shape rounds), `ModerationCommand` (one decision), `GuideService` (orchestrate), pure functions for fingerprint, stats, grounding |
| O | **Yes** | New moderation decision = new command class; new submission form = new subclass; new LLM = new adapter wrapped by the same decorator |
| L | **Yes** | `QuickSubmission` and `DetailedSubmission` both return at least one valid round (tested); every `LlmClient` returns parsed JSON or throws `UpstreamError` (tested) |
| I | **Yes** | Ports split by purpose: `ExperienceReader`, `MyContentReader`, `AdminQueueReader`, `ModerationWriter` has one method, `GuideRepository`, `LlmClient` |
| D | **Yes** | Services take ports; `container.js` is the only file naming concrete classes; tests build the same container with fakes (no database in 116 tests) |

## 10.3 Class diagram versus code (resolved 2026-11-10)

The first audit found that the entity classes and two hierarchies drawn in `03` did not exist in code. **Decision taken:** both of the options we weighed, applied where each is honest.

| Option | What we did |
|---|---|
| Redraw to match reality | `03` now states that the entity model is the database (ADR-25) and draws it as such, with the multiplicity reasoning kept |
| Add a TypeScript domain model | Only where TypeScript genuinely needs the behaviour, and each class is used by running code and tested: `ExperienceLifecycle`, `FeedSort` (`NewestFirst`, `InterviewDateFirst`), `AuthorVisibility` (`AnonymousAuthor`, `NamedAuthor`) |

New user-visible behaviour came with it: the archive can be sorted by interview date (migration 0010, keyset-paged, verified live), and the experience page shows only the actions the state machine allows.

Still not TypeScript classes, deliberately: `Experience`, `Profile`, `Vote`, `Bookmark`, `Report`, `ModerationLog` (tables with database-enforced rules). If an examiner asks "where is the Experience class", the answer is `supabase/migrations/0001_schema.sql` plus `guard_experience`, and `ExperienceLifecycle` is its TypeScript description.

## 10.4 Patterns

| Pattern | Status | Class |
|---|---|---|
| Template Method | Yes | `Submission` |
| Factory | Yes | `SubmissionFactory`, `ModerationCommandFactory`, `SupabaseRepositoryFactory` |
| Command | Yes | `ModerationCommand` family |
| Repository, Adapter | Yes | `Supabase*` classes behind ports; `GeminiClient` adapts Gemini to `LlmClient` |
| Decorator | Yes | `FallbackLlmClient` wraps `LlmClient`s |
| Composition root | Yes | `container.js` |
| State | Yes | `ExperienceLifecycle` (TypeScript) mirrors the trigger (database); parity tested |
| Strategy | Yes | `FeedSort` with two implementations |
| Polymorphism (author) | Yes | `AuthorVisibility` |
| Builder | Changed | Dropped, with reason in `05` |

## 10.5 Evaluation criteria

| Criterion | Status | Gap |
|---|---|---|
| 1 Requirements | Yes | `01` exists. All functional requirements FR-01 to FR-46 are now built; the AI guide (FR-06) is verified against fakes only |
| 2 Class diagram | **Yes** | `03` rewritten to match the code (10.3) |
| 3 OOP | Yes | Abstraction (ports), encapsulation (`CompanyGuide`, `ExperienceLifecycle`), inheritance (`Submission`, `FeedSort`, `AuthorVisibility`, `AppError`), polymorphism (strategies, commands). Entities with data-only behaviour are tables |
| 4 SOLID | Yes | 10.2 |
| 5 Patterns | Yes | 10.4 |
| 6 Sequence and activity diagrams | Yes, not re-verified | `06` should be re-read against the final flows (guide and company admin added after it was written) |
| 7 API design | Yes | Layers and envelope match `07`; `07` notes what is not built |
| 8 Database schema | Yes | `08` §8.7 lists as-built differences; 8 migrations |
| 9 Errors and concurrency | **Yes, with one gap** | `apps/api/scripts/concurrency-check.mjs` fires simultaneous requests at the running stack. Run live: 25 parallel votes by one user left exactly 1 vote; 12 parallel approvals of one pending post gave 1 success and 11 conflicts with one log row and a consistent company counter; 80 parallel interactions against a 60/min limit admitted exactly the remaining 10 (130 attempts counted, 0 server errors). **Gap:** the two-students-create-the-same-company race relies on the unique constraint and is not fired in parallel (the daily submit limit stopped the second request) |
| 10 Working implementation | Mostly | Sign-in, archive, submit, edit and result update, my posts and saved, report, admin queues (posts, edits, reports, companies), post on behalf, account deletion all ran end to end. Only the live Gemini call is unverified |

## 10.6 Documented rules we have not met yet

1. A concurrency claim needs a test that fails when its defence is removed (`CLAUDE.md` §15). The parallel script proves the defences hold; it does not prove they would fail without the constraint (no mutation test).
2. `Idempotency-Key` on submit: designed in `09`, deferred (`07` says so).
3. Public reads are not rate limited (`02` ADR-11 listed it as not applied yet for GETs, so this matches).
4. Accessibility and responsiveness: audited at 390 and 320 px on every working page (details in 10.8). Not yet done: a screen-reader pass and a full keyboard walk-through.
5. NFR-05 evidence exists for the database (`003_query_plans.sql`) but not for API latency.

## 10.7 Features added after the first audit (migration 0009) and how they follow the rules

| Feature | Rule it must obey | Evidence |
|---|---|---|
| Edit and result update (FR-24, FR-25) | ADR-15: a live post is never changed in place; readers keep the approved version | `004` §1: public still sees the old outcome and rounds while the owner sees the waiting change; admin approval swaps content and re-indexes search; reject needs a note; anonymity applies at once |
| Account deletion (FR-12) | ADR-23: service role only for a short named list; admin cannot self-delete | Verified live with a throwaway auth user: live post kept, detached and anonymous (author_id and branch null), non-live post deleted, auth user and profile gone. Admin refused in service and database; `prepare_account_deletion` not callable by users (`004` §9) |
| Post on behalf (FR-45) | ADR-18 consent; admin only; logged | `004` §7: student blocked, missing consent rejected, public author shows the admin-entered name, `post-on-behalf` logged |
| Reports queue (FR-43) | ADR-10 append-only log, compare-and-set | `004` §8: dismiss logged with report id; second dismiss is a 409; students blocked |
| New routes | ADR-11, ADR-16, ADR-19 | `features.test.js` (13 tests): validation, strips identity fields, rate limits (edit 20/h, delete-account 3/day), role checks at route and service |

Patterns added: none new. `AdminOpsService` and `AccountService` follow the same port and composition-root structure; `UpdateService` maps the shared Zod shape to the database payload.

## 10.8 Phone and accessibility pass (NFR-10, NFR-12)

Method: every working page loaded at 390 px and 320 px, with seeded test data (long names, long unbroken URLs, many posts, queues), checking horizontal overflow, clipped header content, controls under 40 px tall, unlabeled form controls, unnamed buttons, heading order, landmarks, and computed text contrast.

| Found | Fixed |
|---|---|
| Header links ran past the right edge at 320 px | Header becomes two rows on phones; links are 44 px tall and all four fit |
| Sign in and Account were hidden on phones on the working pages | Kept visible (the landing page's phone rule was leaking onto them) |
| Brand link 22 to 28 px tall; "Post on behalf" summary 19 px | 44 px |
| Heading jumps (page title straight to card titles) | Card and row titles are `h2`; the admin queue has its own `h2` |
| No skip link | Added, targets `main#top` on every page |
| "1 rounds" | Pluralised |
| Action buttons misaligned on phones | Stack and stretch |

Result after fixes: no horizontal overflow, no clipped header content, no controls under 40 px (inline citation markers are 28 px, above the 24 px WCAG 2.2 minimum), every form control labelled, every page has one `h1`, a `main` landmark and `lang="en"`. Contrast check flagged only the selected segment-button label, which is a false positive of the checker (light text on a dark sibling element). **Not done:** screen-reader testing and a full keyboard walk-through.


## 10.9 Tidy-up before the evaluation (2026-11-15)

| Change | Why | Evidence |
|---|---|---|
| Docs say `.js` for API files, README status updated, ADR index and statuses completed (ADR-25 to 28 accepted) | The design is the contract; it had drifted from ADR-27 | `grep -rn "\.ts" docs/design` shows only shared and web files |
| `SupabaseWriters.js` split: list reads moved to `SupabaseReaders.js`; `mappers2.js` merged into `mappers.js` | One reason to change per file; reads and writes follow the split ports (SRP, ISP) | `npm test` |
| `ModerationCommandFactory` uses a lookup table instead of a `switch` | Open/Closed: a new decision is one class and one entry | `writes.test.js` moderation tests |
| `ExperienceService.getById` returns a new object | No mutation of what the reader returned | `api.test.js`, `model.test.js` |
| New `tests/ports.test.js` | JavaScript has no interfaces, so the test reads each port's methods from `domain/ports.js` and fails if an adapter lacks one, or if a read port gains a write method | 22 tests, 116 in total |
| `06` sequence diagrams: 6.2 now matches the middleware order; 6.9 (edit a live post) added | Diagrams must match the flows | review against `routes/index.js` |

Still open and stated honestly: `Idempotency-Key` on submit (deferred), API latency measurement (NFR-05), screen-reader pass (NFR-10), no mutation test for the concurrency defences.
