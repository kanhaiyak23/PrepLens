# 6. Sequence, Activity and State Diagrams

Each diagram shows who calls whom, where the trust boundary is, and where a decision from `02-decisions.md` takes effect (noted as `ADR-xx`).

## 6.1 Sign in with domain restriction (UC-04, ADR-05)

```mermaid
sequenceDiagram
    actor U as Student
    participant B as Browser
    participant N as Next.js (server)
    participant G as Google
    participant S as Supabase Auth
    participant DB as Postgres

    U->>B: Click "Continue with Google"
    B->>N: signIn()
    N->>S: signInWithOAuth(google)
    S-->>B: redirect to Google
    B->>G: consent screen
    G-->>S: code + profile
    S->>DB: insert into auth.users
    Note over DB: Trigger / before-user-created hook<br/>checks domain == nst.rishihood.edu.in (exact)
    alt domain not allowed
        DB-->>S: raise error
        S-->>B: redirect to /signin?error=domain
        B-->>U: Readable explanation, no redirect loop
    else allowed
        DB->>DB: create profiles row (role=student)
        S-->>B: set session cookie
        B->>N: GET /welcome
        N-->>U: Ask for batch and branch (first time only)
    end
```

## 6.2 Submit an experience (UC-06, ADR-14, ADR-16, ADR-11, ADR-18)

As built, the order is the middleware chain in `routes/index.js`: authenticate, rate limit, validate, controller. The rate limiter is middleware, not a service call.

```mermaid
sequenceDiagram
    actor U as Student
    participant MW as Middleware chain
    participant L as RateLimiter (Postgres)
    participant Z as Zod submissionSchema
    participant CT as ExperienceController
    participant SV as SubmissionService
    participant F as SubmissionFactory
    participant R as ExperienceWriter (Supabase)
    participant DB as Postgres

    U->>MW: POST /api/v1/experiences (bearer token)
    MW->>MW: authenticate: user id from token, role from DB, never from body
    MW->>L: consume(u:userId, "submit", 5, 1 day)
    alt over limit
        L-->>U: 429 RateLimitedError
    else allowed
        MW->>Z: parse(body)
        alt invalid
            Z-->>U: 400 ValidationError (fields)
        else valid
            MW->>CT: submit(req.valid.body)
            CT->>SV: submit(dto)
            SV->>F: create(dto)
            F-->>SV: QuickSubmission or DetailedSubmission
            SV->>SV: toPayload() (Template Method: validate, normalise rounds, consent true)
            SV->>R: submit(payload)
            R->>DB: rpc submit_experience in ONE transaction
            Note over DB: resolve company by slug or alias, else create pending<br/>insert experience, rounds, questions<br/>snapshot author batch and branch<br/>CHECK consent, status = pending
            DB-->>R: id
            R-->>CT: id
            CT-->>U: 201 { id, status: pending }
        end
    end
```

## 6.3 Admin approves a submission (UC-11, ADR-10, ADR-15)

```mermaid
sequenceDiagram
    actor A as Admin
    participant C as Express route + controller
    participant MS as ModerationService
    participant CMD as ApproveCommand
    participant R as ExperienceRepository
    participant LG as ModerationLogRepository
    participant DB as Postgres

    A->>C: POST /api/v1/admin/experiences/{id}/approve
    C->>C: authenticate, load profile, requireRole(admin)
    C->>MS: execute(new ApproveCommand(id, admin))
    MS->>CMD: execute()
    CMD->>R: findById(id)
    R-->>CMD: Experience(status=pending)
    CMD->>CMD: experience.publish(admin) (state check)
    CMD->>R: save(experience) with WHERE status='pending'
    R->>DB: UPDATE ... WHERE id=? AND status='pending'
    alt 0 rows (someone else decided first)
        DB-->>R: 0 rows
        R-->>CMD: ConflictError
        CMD-->>A: "Already decided"
    else 1 row
        CMD->>LG: append(approve, adminId, companyName, role)
        LG->>DB: INSERT moderation_logs (append only)
        CMD-->>MS: ok
        MS-->>C: ok
        C-->>A: 200 (web app revalidates its cache tags)
    end
```

## 6.4 Vote, idempotent under double tap (UC-09, ADR-07)

```mermaid
sequenceDiagram
    actor U as Student
    participant C as Express route + controller
    participant IS as InteractionService
    participant L as RateLimiter
    participant IR as InteractionRepository
    participant DB as Postgres

    U->>C: PUT /api/v1/experiences/{id}/vote (tapped twice quickly)
    par request 1
        C->>IS: vote(exp, user)
        IS->>L: consume(user, "interact")
        IS->>IR: addVote(exp, user)
        IR->>DB: INSERT ... ON CONFLICT DO NOTHING
        DB-->>IR: 1 row
    and request 2
        C->>IS: vote(exp, user)
        IS->>IR: addVote(exp, user)
        IR->>DB: INSERT ... ON CONFLICT DO NOTHING
        DB-->>IR: 0 rows (already there)
    end
    Note over DB: Trigger increments upvote_count only when a row was inserted.<br/>Final count is exactly 1.
    IR-->>U: state = voted
```

## 6.5 AI guide with grounding and fallback (UC-03, ADR-12)

```mermaid
sequenceDiagram
    actor V as Visitor
    participant GS as GuideService
    participant ER as ExperienceRepository
    participant GR as GuideRepository
    participant LC as FallbackLlmClient
    participant GM as Gemini

    V->>GS: getGuide("google")
    GS->>ER: findPublishedByCompany("google")
    ER-->>GS: experiences[]
    alt fewer than minimum
        GS-->>V: NotEnoughData (honest empty state)
    else enough
        GS->>GS: fingerprint = hash(ids + updated_at)
        GS->>GR: find(companyId)
        alt cached and fingerprint matches
            GR-->>GS: cached guide
            GS-->>V: guide (no model call)
        else stale or missing
            GS->>LC: generateJson(prompt, schema)
            loop each configured model until one answers
                LC->>GM: generateContent
                GM-->>LC: JSON | 429 | 503
            end
            alt all models failed
                LC-->>GS: LlmError
                GS-->>V: guide panel shows retry message; page still works
            else success
                GS->>GS: parse with Zod, drop citations not in source list
                GS->>GS: compute counts and top topics in code
                GS->>GR: upsert(guide, fingerprint)
                GS-->>V: guide with citations
            end
        end
    end
```

## 6.6 Public read of one experience, anonymity (UC-02, ADR-06)

```mermaid
sequenceDiagram
    actor V as Visitor
    participant W as Next.js Server Component
    participant P as Express route + controller
    participant ES as ExperienceService
    participant R as ExperienceRepository
    participant DB as Postgres (RLS)

    V->>W: GET /experience/:id
    W->>P: GET /api/v1/experiences/{id} (optional bearer token)
    P->>ES: getById(id, viewer)
    ES->>R: findById(id)
    R->>DB: select from public view (status = published)
    alt not found or not published (and viewer not owner/admin)
        DB-->>R: no row
        ES-->>W: 404 (does not reveal that a hidden post exists)
        W-->>V: not-found page
    else found
        R-->>ES: Experience
        ES->>ES: AuthorVisibilityFactory.for(experience)
        ES->>ES: toPublic() (anonymous: batch only)
        ES-->>P: public JSON (Cache-Control: public)
        P-->>W: 200
        W-->>V: page HTML
    end
```

## 6.7 Activity diagram: submission to publication (UC-06, UC-11)

```mermaid
flowchart TD
    A([Student opens form]) --> B[Fill company, role, outcome, rounds]
    B --> C{Anonymous?}
    C -->|yes| D[Mark anonymous]
    C -->|no| E[Identified]
    D --> F[Tick consent]
    E --> F
    F --> G{Zod valid?}
    G -->|no| B
    G -->|yes| H{Within daily limit?}
    H -->|no| X([Show rate-limit message])
    H -->|yes| I{Company known?}
    I -->|yes| K[Create experience: pending]
    I -->|no| J[Create company: pending] --> K
    K --> L[Admin queue]
    L --> M{Admin decision}
    M -->|approve| N([Published, visible to all])
    M -->|reject with note| O([Rejected, author sees note])
```

## 6.8 State diagram: experience lifecycle (ADR-15)

```mermaid
stateDiagram-v2
    [*] --> pending: student submits
    pending --> published: admin approves
    pending --> rejected: admin rejects (note)
    rejected --> pending: author resubmits after edit
    published --> unpublished: author withdraws (instant)
    unpublished --> pending: author republishes (re-review)
    published --> removed: admin removes (logged)
    removed --> pending: admin reinstates, goes back through review
    published --> published: approved update replaces content
```

Transition rules are enforced by the database trigger `guard_experience` and described in code by `ExperienceLifecycle` (`TRANSITIONS`); a test compares the two. The diagram and the code must match: any new transition is added here first.


## 6.9 Edit a live post (UC-07, FR-24, ADR-15, ADR-25)

A live post is never changed in place. The edit becomes a pending update; readers keep seeing the approved version until an admin decides.

```mermaid
sequenceDiagram
    actor A as Author
    actor M as Admin
    participant API as Express (PATCH /experiences/:id)
    participant SV as UpdateService
    participant DB as Postgres functions

    A->>API: PATCH changes (edit limit 20/hour)
    API->>SV: update(id, changes)
    SV->>DB: rpc update_experience
    alt post is published
        DB-->>SV: queued (stored in pending_update)
        SV-->>A: 202 queued, readers still see the old version
    else not live
        DB-->>SV: applied
        SV-->>A: 200 applied
    end
    M->>API: POST /admin/experiences/:id/update/approve
    API->>DB: swap content, re-index search, write moderation log (one transaction)
    DB-->>M: done
    Note over M,DB: reject needs a note; a second edit replaces the first pending one
```
