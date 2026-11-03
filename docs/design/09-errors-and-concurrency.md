# 9. Error Handling, Validation, Edge Cases and Concurrency

Principle: **every failure is classified, every classified failure has a stable code, and the user never sees an internal detail.** (ADR-19)

## 9.1 Error taxonomy

| Class | Code | HTTP | Raised when | User sees |
|---|---|---|---|---|
| `ValidationError` | `VALIDATION_FAILED` | 400 | Zod parse fails, bad cursor, future interview date | Field-level messages |
| `AuthenticationError` | `UNAUTHENTICATED` | 401 | No valid session | Prompt to sign in |
| `ForbiddenError` | `FORBIDDEN` | 403 | Wrong role, not the owner, non-NST account | Plain explanation |
| `NotFoundError` | `NOT_FOUND` | 404 | Missing or not visible (never reveals that a hidden post exists) | Standard not-found page |
| `ConflictError` | `CONFLICT` | 409 | Already decided, duplicate open report, stale update | "Already handled" |
| `RateLimitedError` | `RATE_LIMITED` | 429 | Limiter denies | When they can retry |
| `NotEnoughDataError` | `NOT_ENOUGH_DATA` | 409 | Too few experiences for a guide | Honest empty state |
| `UpstreamError` | `UPSTREAM_UNAVAILABLE` | 503 | Gemini down or malformed | Guide panel message; rest of page unaffected |
| any other | `INTERNAL` | 500 | Bug | Generic message plus `requestId`; detail only in logs |

## 9.2 Validation layers

| Layer | What it checks | Why here |
|---|---|---|
| Browser (UX only) | Required fields, counters | Fast feedback; **never trusted** |
| Zod at the Express validate middleware | Shape, types, ranges, enum membership, string lengths, literal `consent: true` | Parse once, then everything downstream is typed |
| Domain methods | State transitions, consent, anonymity rules | Business invariants |
| Database constraints | CHECK, NOT NULL, UNIQUE, FK, RLS | Survives direct API calls and future bugs |

## 9.3 Edge cases and how each is handled

| Case | Handling |
|---|---|
| Client sends `userId`, `role`, `status` or `authorBatch` in the body | Not in the schema, stripped; test proves no effect |
| Interview date in the future | Zod and DB CHECK reject |
| Company typed as "Google", "google ", "Google India" | Normalised, resolved by slug then alias; one company row |
| Unknown company | Created as `pending`; the experience still saves and waits |
| Same form submitted twice in a second | Rate limit plus a content-derived idempotency key; second returns the first result |
| Experience hidden while someone has the link | 404 for everyone except owner and admin |
| Edit of a live post | Stored as pending update; readers keep the approved version; a second edit replaces the first pending one |
| Account deleted with "keep" | `author_id` set null, row forced anonymous, author name cleared |
| Admin tries to delete own account | Forbidden (keeps the log's admin reference resolvable) |
| Anonymous post plus branch | Branch never serialised; public view omits the column |
| Gemini returns citation numbers that do not exist | Dropped before storing |
| Gemini returns malformed JSON | `UpstreamError`; nothing cached |
| All models rate limited | Fallback decorator tries the next; if all fail, 503 for the guide only |
| Cursor tampered with | 400 |
| Empty filter result | Designed empty state with a clear-filters action |
| Domain lookalike email | Rejected by exact comparison |

## 9.4 Concurrency scenarios

| Scenario | Race | Defence | Concept |
|---|---|---|---|
| Double-tap vote | Two requests both see "no vote" | Primary key `(user_id, experience_id)` plus `ON CONFLICT DO NOTHING` | Constraint beats check-then-act |
| Counter drift | Votes and counter updated separately | Counter changed by a trigger in the same transaction as the vote row | Atomicity |
| Two admins approve and reject the same post | Both read `pending` | `UPDATE ... WHERE id = ? AND status = 'pending'`; zero rows means `ConflictError` | Optimistic concurrency (compare-and-set) |
| Author edits while admin approves | Stale content approved | Compare `updated_at` or a version column in the same UPDATE | Optimistic locking |
| Two students create the same new company at once | Both insert | Unique slug; loser catches the unique violation and re-reads | Unique constraint as the arbiter |
| Submission writes experience, rounds, questions | Crash midway leaves a half post | One transaction in an RPC | ACID |
| Many requests regenerate the same AI guide | Duplicate model calls and cost | Upsert on unique `company_id`; optionally an advisory lock per company | Idempotent write, single flight |
| Rate limiter counted from several serverless instances | In-memory counters disagree | Atomic upsert increment in Postgres | Shared state |

## 9.5 Test plan for this document

Each row in 9.3 and 9.4 becomes at least one automated test: Vitest for services with fakes, SQL tests for constraints and RLS, and parallel-request tests for the races. A concurrency claim without a test that fails when the defence is removed is not accepted as done.

## 9.6 Logging and observability

A `requestId` is generated per request, echoed in the error envelope and the `x-request-id` header, and stamped on every log line. Logs never contain emails, tokens or full request bodies.
