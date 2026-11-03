# PrepLens

A public archive of NST placement interview experiences, round by round, written by seniors for juniors. Students sign in with their college Google account, share an experience (anonymously if they choose), and juniors read, search, save and learn from them. An admin team reviews what is posted. An AI prep guide summarises each company and cites the experiences behind every claim.

This README holds **every diagram** of the system. The reasoning behind each choice is in [`docs/design/02-decisions.md`](docs/design/02-decisions.md) and [`docs/design/05-design-patterns.md`](docs/design/05-design-patterns.md), each with its own diagram.

## Contents

1. [Stack and repository layout](#1-stack-and-repository-layout)
2. [Run it](#2-run-it)
3. [Architecture diagrams](#3-architecture-diagrams) (system, layers, request pipeline, trust boundaries)
4. [Data model](#4-data-model) (ER diagram)
5. [Class diagrams](#5-class-diagrams) (layers and ports, domain model)
6. [Sequence diagrams](#6-sequence-diagrams) (sign-in, submit, moderate, vote, edit, AI guide, delete account, company merge)
7. [State and activity diagrams](#7-state-and-activity-diagrams)
8. [Where everything else is](#8-where-everything-else-is)

## 1. Stack and repository layout

| Part | Technology |
|---|---|
| Web app | Next.js 16 (App Router), React, TypeScript, Tailwind 4, GSAP, Three.js, Motion |
| API | Node.js, Express 5, TypeScript, Zod, pino |
| Data and identity | Supabase Postgres, Supabase Auth (Google), Row Level Security |
| AI | Google Gemini, called only from the API |
| Tests | Vitest and Supertest (API), SQL tests (database), Chrome automation (UI) |

```
apps/web        Next.js app: landing page and the working pages
apps/api        Express API: routes, controllers, services, domain, infrastructure
packages/shared Zod schemas, enums and response types used by both apps
supabase/       migrations (0001 to 0010) and repeatable database tests
docs/design/    requirements, decisions, patterns, diagrams, audit
```

## 2. Run it

```bash
npm install
cp apps/api/.env.example apps/api/.env      # fill in the Supabase and Gemini values
npm test                                    # builds shared, runs the API tests
npm run dev:api                             # API on :4000
cd apps/web && npm run dev -- -p 3100       # web on :3100
```

Database tests live in `supabase/tests/` (each rolls itself back). A parallel-request check is in `apps/api/scripts/concurrency-check.mjs`.

## 3. Architecture diagrams

### 3.1 System context

Who talks to what. The browser never talks to the database tables directly, and only the API holds the Gemini key and the Supabase service-role key.

```mermaid
flowchart LR
  U["Browser<br/>visitor, student or admin"]
  W["Next.js web app<br/>:3100"]
  A["Express API<br/>:4000"]
  SA["Supabase Auth"]
  G["Google OAuth"]
  DB[("Supabase Postgres<br/>RLS on every table")]
  GEM["Gemini API"]

  U --> W
  U -- "sign in" --> SA
  SA --> G
  W -- "Bearer access token<br/>JSON over HTTPS" --> A
  A -- "user-scoped client<br/>RLS and auth.uid apply" --> DB
  A -- "service role, short list only:<br/>rate limiter, guide cache,<br/>account deletion" --> DB
  A -- "structured JSON,<br/>key in a header" --> GEM
  A -- "verify token" --> SA
```

### 3.2 Layers inside the API

Dependencies point inward. The domain imports nothing from Express, Supabase or services. Only `container.ts` names concrete classes.

```mermaid
flowchart TB
  subgraph PRES["Presentation"]
    R["routes"] --> C["controllers<br/>parse, call one service, shape response"]
    MW["middleware<br/>auth, role, rate limit, validate, errors"]
  end
  subgraph APP["Application"]
    S["services<br/>orchestrate, no SQL"]
  end
  subgraph DOM["Domain"]
    P["ports<br/>interfaces"]
    M["model<br/>ExperienceLifecycle, FeedSort,<br/>AuthorVisibility, Submission,<br/>ModerationCommand, CompanyGuide, errors"]
  end
  subgraph INF["Infrastructure"]
    I["Supabase repositories<br/>Gemini adapter and fallback decorator<br/>Postgres rate limiter<br/>account deleter"]
  end
  CR["container.ts<br/>composition root"]

  C --> S
  MW --> C
  S --> P
  S --> M
  I -. "implements" .-> P
  CR --> I
  CR --> S
```

### 3.3 Request pipeline

The same chain runs on every route. A route is just a list of these steps.

```mermaid
flowchart LR
  RQ["request"] --> ID["request id"]
  ID --> SEC["helmet and CORS<br/>one explicit origin"]
  SEC --> JS["JSON body, 100 KB cap"]
  JS --> AU{"authenticate<br/>optional or required"}
  AU -- "bad or malformed token" --> E401["401"]
  AU --> RO{"role check<br/>admin routes"}
  RO -- "not admin" --> E403["403"]
  RO --> RL{"rate limit<br/>keyed on user or hashed IP"}
  RL -- "over limit" --> E429["429"]
  RL --> VA{"Zod validate<br/>params, query, body"}
  VA -- "invalid" --> E400["400 with field errors"]
  VA --> CT["controller"] --> SV["service"] --> RP["repository"] --> DBX[("database function")]
  CT -. "any thrown error" .-> EH["error handler<br/>one envelope and request id"]
```

### 3.4 Trust boundaries

Every rule is enforced at more than one of these points, so a bug in one layer cannot become a leak.

```mermaid
flowchart LR
  subgraph UNTRUSTED["Untrusted"]
    B["Browser input"]
    L["LLM output"]
  end
  subgraph API["API: validates and decides"]
    Z["Zod parse"]
    AZ["role from DB per request"]
    GR["citation grounding"]
  end
  subgraph DBL["Database: final authority"]
    CK["CHECK, UNIQUE, FK"]
    TR["triggers: domain, lifecycle, append-only"]
    FN["security definer functions<br/>auth.uid, anonymity, CAS"]
    RLS["RLS and revoked grants"]
  end
  B --> Z --> AZ --> FN
  L --> GR --> FN
  FN --> CK
  FN --> TR
  RLS -. "closes direct table access" .-> FN
```

## 4. Data model

The tables are the entity model (decision ADR-25): the rules that protect the data live in the database, not in copies of the entities in TypeScript.

```mermaid
erDiagram
  PROFILES {
    uuid id PK
    text email UK
    text full_name
    int graduation_batch
    text branch
    text role "student or admin"
  }
  COMPANIES {
    uuid id PK
    text slug UK
    text name
    text_array aliases
    text status "active or pending"
    int experience_count
  }
  EXPERIENCES {
    uuid id PK
    uuid company_id FK
    uuid author_id FK "nullable"
    text role
    text drive_type
    int interview_year
    text outcome
    text campus
    text status "5 states"
    bool is_anonymous
    timestamptz consented_at "CHECK: required to publish"
    jsonb pending_update
    int upvote_count
    tsvector search_tsv
  }
  INTERVIEW_ROUNDS {
    uuid id PK
    uuid experience_id FK
    int position "UNIQUE with experience"
    text name
    text tips
  }
  QUESTIONS {
    uuid id PK
    uuid round_id FK
    int position "UNIQUE with round"
    text text
    text topic
  }
  VOTES {
    uuid user_id PK
    uuid experience_id PK
  }
  BOOKMARKS {
    uuid user_id PK
    uuid experience_id PK
  }
  REPORTS {
    uuid id PK
    uuid experience_id FK
    uuid reporter_id FK "nullable"
    text reason
    text status
  }
  MODERATION_LOGS {
    uuid id PK
    text action
    uuid experience_id FK "nullable"
    uuid admin_id FK
    text company_name "copied"
    text role "copied"
  }
  COMPANY_GUIDES {
    uuid id PK
    uuid company_id FK "UNIQUE"
    text fingerprint
    jsonb content
    uuid_array source_ids
  }
  RATE_LIMITS {
    text key PK
    text action PK
    timestamptz window_start PK
    int count
  }

  PROFILES ||--o{ EXPERIENCES : "authors, nullable"
  COMPANIES ||--o{ EXPERIENCES : has
  EXPERIENCES ||--|{ INTERVIEW_ROUNDS : "composed of"
  INTERVIEW_ROUNDS ||--o{ QUESTIONS : contains
  PROFILES ||--o{ VOTES : casts
  EXPERIENCES ||--o{ VOTES : receives
  PROFILES ||--o{ BOOKMARKS : keeps
  EXPERIENCES ||--o{ BOOKMARKS : "saved in"
  EXPERIENCES ||--o{ REPORTS : "subject of"
  PROFILES ||--o{ REPORTS : files
  PROFILES ||--o{ MODERATION_LOGS : performs
  EXPERIENCES ||--o{ MODERATION_LOGS : concerns
  COMPANIES ||--o| COMPANY_GUIDES : "summarised by"
```

## 5. Class diagrams

### 5.1 Services, ports and adapters

```mermaid
classDiagram
direction LR

class ExperienceController
class MeController
class AdminController
class GuideController

class ExperienceService { +getFeed(q) +getById(id) }
class SubmissionService { +submit(dto) }
class UpdateService { +update(id, dto) +cancel(id) }
class LifecycleService { +unpublish(id) +republish(id) }
class InteractionService { +vote() +bookmark() +state() }
class ModerationService { +execute(cmd) +list(q) }
class AdminOpsService { +listUpdates() +decideUpdate() +listReports() +dismissReport() +postOnBehalf() }
class CompanyAdminService { +listPending() +decide() }
class GuideService { +getGuide(slug) }
class AccountService { +delete(posts) }

class ExperienceReader { <<interface>> }
class ExperienceWriter { <<interface>> }
class ModerationWriter { <<interface>> }
class GuideRepository { <<interface>> }
class LlmClient { <<interface>> }
class RateLimiter { <<interface>> }
class AccountDeleter { <<interface>> }
class TokenVerifier { <<interface>> }

class SupabaseExperienceReader
class SupabaseExperienceWriter
class SupabaseGuideRepository
class GeminiClient
class FallbackLlmClient
class PostgresRateLimiter
class SupabaseAccountDeleter
class SupabaseTokenVerifier

ExperienceController ..> ExperienceService
ExperienceController ..> SubmissionService
ExperienceController ..> UpdateService
ExperienceController ..> LifecycleService
AdminController ..> ModerationService
AdminController ..> AdminOpsService
GuideController ..> GuideService
MeController ..> AccountService
ExperienceService ..> ExperienceReader
SubmissionService ..> ExperienceWriter
UpdateService ..> ExperienceWriter
ModerationService ..> ModerationWriter
GuideService ..> LlmClient
GuideService ..> GuideRepository
AccountService ..> AccountDeleter

SupabaseExperienceReader ..|> ExperienceReader
SupabaseExperienceWriter ..|> ExperienceWriter
SupabaseGuideRepository ..|> GuideRepository
GeminiClient ..|> LlmClient
FallbackLlmClient ..|> LlmClient
FallbackLlmClient o-- LlmClient : wraps
PostgresRateLimiter ..|> RateLimiter
SupabaseAccountDeleter ..|> AccountDeleter
SupabaseTokenVerifier ..|> TokenVerifier
```

### 5.2 Domain model (TypeScript classes that carry behaviour)

```mermaid
classDiagram
direction TB

class Submission {
  <<abstract>>
  +toPayload() SubmitPayload
  #normaliseRounds() RoundPayload[]
  #validateSpecific() void
}
class QuickSubmission
class DetailedSubmission
Submission <|-- QuickSubmission
Submission <|-- DetailedSubmission
class SubmissionFactory { +create(dto) Submission }
SubmissionFactory ..> Submission

class FeedSort {
  <<abstract>>
  +name
  +nextCursor(card) string
  +after(cursor) FeedAfter
  #keyOf(card) string
  #resume(key, id) FeedAfter
}
class NewestFirst
class InterviewDateFirst
FeedSort <|-- NewestFirst
FeedSort <|-- InterviewDateFirst

class AuthorVisibility { <<abstract>> +toPublic() PublicAuthor }
class AnonymousAuthor
class NamedAuthor
AuthorVisibility <|-- AnonymousAuthor
AuthorVisibility <|-- NamedAuthor
class AuthorVisibilityFactory { +fromDb(raw) AuthorVisibility }
AuthorVisibilityFactory ..> AuthorVisibility

class ExperienceLifecycle {
  +TRANSITIONS
  +canMove(from, to) bool
  +actionsFor(ctx) ExperienceAction[]
}

class ModerationCommand { <<interface>> +action +experienceId +run(writer) }
class ApproveCommand
class RejectCommand
class RemoveCommand
class ReinstateCommand
ModerationCommand <|.. ApproveCommand
ModerationCommand <|.. RejectCommand
ModerationCommand <|.. RemoveCommand
ModerationCommand <|.. ReinstateCommand
class ModerationCommandFactory { +create(action, id, note) }
ModerationCommandFactory ..> ModerationCommand

class CompanyGuide {
  +fingerprint
  +sourceIds
  +isStale(fp) bool
  +citesOnly(ids) bool
  +toView(company, stale) GuideView
}

class AppError {
  <<abstract>>
  +code
  +httpStatus
  +fields
}
class ValidationError
class AuthenticationError
class ForbiddenError
class NotFoundError
class ConflictError
class RateLimitedError
class NotEnoughDataError
class UpstreamError
AppError <|-- ValidationError
AppError <|-- AuthenticationError
AppError <|-- ForbiddenError
AppError <|-- NotFoundError
AppError <|-- ConflictError
AppError <|-- RateLimitedError
AppError <|-- NotEnoughDataError
AppError <|-- UpstreamError
```

## 6. Sequence diagrams

### 6.1 Sign in, and the college-domain rule

The domain check is a database trigger, so it holds no matter which client calls Supabase Auth.

```mermaid
sequenceDiagram
  actor U as Student
  participant W as Web app
  participant SA as Supabase Auth
  participant G as Google
  participant DB as Postgres

  U->>W: Continue with Google
  W->>SA: signInWithOAuth, hd hint only
  SA-->>U: redirect to Google
  U->>G: choose account
  G-->>SA: code and profile
  SA->>DB: insert into auth.users
  Note over DB: trigger: email must match<br/>name@nst.rishihood.edu.in exactly
  alt other domain or lookalike
    DB-->>SA: error
    SA-->>W: error on callback
    W-->>U: "Only NST accounts can sign in"
  else allowed
    DB->>DB: create profile, admin if listed
    SA-->>W: code on /auth/callback
    W->>SA: exchange code for session
    W-->>U: /welcome
  end
```

### 6.2 Submit an experience

```mermaid
sequenceDiagram
  actor U as Student
  participant W as Web
  participant A as API route
  participant S as SubmissionService
  participant F as SubmissionFactory
  participant R as ExperienceWriter
  participant DB as Postgres

  U->>W: fill form, tick consent
  W->>A: POST /experiences, Bearer token
  A->>A: authenticate, rate limit 5 per day, Zod parse
  A->>S: submit(dto)
  S->>F: create(dto)
  F-->>S: QuickSubmission or DetailedSubmission
  S->>S: toPayload() normalises to rounds
  S->>R: submit(payload)
  R->>DB: rpc submit_experience (one transaction)
  Note over DB: needs profile batch and branch<br/>consent literal true<br/>company resolved or created pending<br/>author fields snapshotted from the token's user
  DB-->>R: id
  A-->>W: 201 status pending
```

### 6.3 Admin decision, with compare-and-set

```mermaid
sequenceDiagram
  actor A1 as Admin 1
  actor A2 as Admin 2
  participant API as API
  participant MS as ModerationService
  participant C as ApproveCommand
  participant DB as Postgres

  par at the same moment
    A1->>API: POST approve
    API->>MS: execute(cmd)
    MS->>C: run(writer)
    C->>DB: moderate_experience
    Note over DB: UPDATE where status = pending
    DB-->>C: published, log row written
    API-->>A1: 200 published
  and
    A2->>API: POST approve
    API->>MS: execute(cmd)
    MS->>C: run(writer)
    C->>DB: moderate_experience
    Note over DB: 0 rows updated
    DB-->>C: CONFLICT
    API-->>A2: 409 already decided
  end
```

### 6.4 Vote, idempotent under a double tap

```mermaid
sequenceDiagram
  actor U as Student
  participant API as API
  participant DB as Postgres

  par request 1
    U->>API: PUT vote
    API->>DB: vote_experience
    Note over DB: INSERT ON CONFLICT DO NOTHING
    DB-->>API: 1 row inserted, count 1
  and request 2
    U->>API: PUT vote
    API->>DB: vote_experience
    DB-->>API: 0 rows inserted, count 1
  end
  Note over DB: trigger adds 1 only when a row was inserted
  API-->>U: voted true, count 1
```

### 6.5 Edit or update the result of a live post

```mermaid
sequenceDiagram
  actor Au as Author
  actor Ad as Admin
  actor R as Reader
  participant API as API
  participant DB as Postgres

  Au->>API: PATCH /experiences/id, outcome selected
  API->>DB: update_experience
  alt post is published
    DB->>DB: store in pending_update
    DB-->>API: queued
    API-->>Au: 202 waiting for review
  else not public yet
    DB->>DB: apply directly
    API-->>Au: 200 applied
  end
  R->>API: GET /experiences/id
  API-->>R: still the approved version
  Ad->>API: GET /admin/updates
  Ad->>API: POST update approve
  API->>DB: admin_decide_update
  DB->>DB: swap content in, re-index search, clear pending, log approve-update
  R->>API: GET /experiences/id
  API-->>R: new version
```

### 6.6 AI prep guide: grounded, cached, degradable

```mermaid
sequenceDiagram
  actor V as Visitor
  participant G as GuideService
  participant SR as GuideSourceReader
  participant GR as GuideRepository
  participant L as FallbackLlmClient
  participant M as Gemini

  V->>G: getGuide(slug)
  G->>SR: forCompany(slug)
  SR-->>G: published experiences, authors anonymised
  alt fewer than 3
    G-->>V: 409 not enough data
  else enough
    G->>G: fingerprint = hash of ids and update times
    G->>GR: find(companyId)
    alt cached and fingerprint matches
      GR-->>G: guide
      G-->>V: guide, no model call
    else stale or missing
      G->>L: generateJson(prompt, schema)
      loop each model while failure is transient
        L->>M: generateContent
        M-->>L: JSON or 404, 429, 5xx
      end
      alt model unavailable
        L-->>G: UpstreamError
        alt old guide cites only still-published posts
          G-->>V: old guide marked stale
        else a cited post was withdrawn
          G-->>V: 503, never show withdrawn content
        end
      else answered
        G->>G: Zod parse, keep real citations, drop uncited claims
        G->>G: counts and top topics computed in code
        G->>GR: save (upsert on company)
        G-->>V: guide
      end
    end
  end
```

### 6.7 Delete my account

```mermaid
sequenceDiagram
  actor U as Student
  participant W as Web
  participant API as API
  participant AS as AccountService
  participant AD as AccountDeleter
  participant DB as Postgres
  participant SA as Supabase Auth

  U->>W: choose keep or delete, type DELETE
  W->>API: DELETE /me?posts=keep
  API->>API: authenticate, rate limit 3 per day
  API->>AS: delete(keep)
  alt admin account
    AS-->>API: ForbiddenError
    API-->>W: 403
  else student
    AS->>AD: delete(userId, keepLive)
    AD->>DB: prepare_account_deletion (service role)
    Note over DB: keep: live posts detached,<br/>author and branch cleared, forced anonymous<br/>posts not yet public deleted
    AD->>SA: admin deleteUser
    SA->>DB: cascade removes profile
    API-->>W: kept and deleted counts
    W->>SA: sign out, go home
  end
```

### 6.8 Company merge

```mermaid
sequenceDiagram
  actor S as Student
  actor A as Admin
  participant API as API
  participant DB as Postgres

  S->>API: submit experience, company Googel
  API->>DB: submit_experience
  DB->>DB: no match, create company Googel as pending
  A->>API: GET /admin/companies/pending
  A->>API: POST /admin/companies/googel/merge into google
  API->>DB: admin_decide_company
  Note over DB: one transaction:<br/>move posts, add alias Googel,<br/>recount published, re-index search,<br/>delete typo company, log merge-company
  DB-->>API: merged
```

## 7. State and activity diagrams

### 7.1 Experience lifecycle (state machine)

Enforced by a database trigger and described in TypeScript by `ExperienceLifecycle`; a test fails if the two tables differ. Nothing is ever hard-deleted by an admin.

```mermaid
stateDiagram-v2
  [*] --> pending: student submits
  pending --> published: admin approves
  pending --> rejected: admin rejects with a note
  pending --> unpublished: author withdraws
  rejected --> pending: author edits and resubmits
  published --> unpublished: author withdraws, instant
  unpublished --> pending: author republishes, reviewed again
  published --> removed: admin removes, logged
  removed --> pending: admin reinstates, reviewed again
  published --> published: approved edit swaps content in
```

### 7.2 A change to a live post

```mermaid
stateDiagram-v2
  [*] --> Approved: live post
  Approved --> Waiting: author proposes a change
  Waiting --> Waiting: author proposes again, replaces it
  Waiting --> Approved: author cancels
  Waiting --> Approved: admin rejects with a note
  Waiting --> Approved: admin approves, new content live
```

### 7.3 From writing to being read

```mermaid
flowchart TD
  A([Student opens the form]) --> B["Quick note or round by round"]
  B --> C{"Anonymous?"}
  C -- yes --> D["Batch only will be shown"]
  C -- no --> E["Name, batch, branch shown"]
  D --> F["Tick consent"]
  E --> F
  F --> G{"Valid and under 5 a day?"}
  G -- no --> B
  G -- yes --> H{"Company known?"}
  H -- yes --> K["Experience pending"]
  H -- no --> J["Company pending"] --> K
  K --> L["Admin queue"]
  L --> M{"Admin decision"}
  M -- approve --> N(["Published, public"])
  M -- "reject with note" --> O(["Rejected, author sees the note"])
  N --> P{"Reader reports it?"}
  P -- yes --> Q["Reports queue"]
  Q --> R{"Admin"}
  R -- dismiss --> N
  R -- remove --> S(["Removed, reports settled, logged"])
```

## 8. Where everything else is

| What | Where |
|---|---|
| Requirements, actors, use cases | [`docs/design/01-requirements.md`](docs/design/01-requirements.md) |
| Every decision with its reason and a diagram | [`docs/design/02-decisions.md`](docs/design/02-decisions.md) |
| Every design pattern with a diagram | [`docs/design/05-design-patterns.md`](docs/design/05-design-patterns.md) |
| OOP and SOLID, where each is applied | [`docs/design/04-oop-and-solid.md`](docs/design/04-oop-and-solid.md) |
| API contract and endpoint table | [`docs/design/07-api-design.md`](docs/design/07-api-design.md) |
| Database schema, indexes, RLS | [`docs/design/08-database-schema.md`](docs/design/08-database-schema.md) |
| Errors and concurrency | [`docs/design/09-errors-and-concurrency.md`](docs/design/09-errors-and-concurrency.md) |
| Audit of code against the design | [`docs/design/10-compliance.md`](docs/design/10-compliance.md) |
