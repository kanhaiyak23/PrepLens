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

```mermaid
sequenceDiagram
    actor U as Student
    participant C as Express route + controller
    participant Z as Zod schema
    participant SV as SubmissionService
    participant L as RateLimiter
    participant F as SubmissionFactory
    participant R as ExperienceRepository
    participant DB as Postgres

    U->>C: POST /api/v1/experiences (bearer token)
    C->>C: authenticate middleware verifies bearer token (user id from token, never from body)
    C->>Z: parse(form)
    alt invalid
        Z-->>C: field errors
        C-->>U: ValidationError (fields)
    else valid
        C->>SV: submit(dto, author)
        SV->>L: consume(userId, "submit")
        alt over limit (5/day)
            L-->>SV: denied
            SV-->>U: RateLimitedError
        else allowed
            SV->>F: create(dto)
            F-->>SV: QuickSubmission | DetailedSubmission
            SV->>SV: toExperience(author) (snapshot batch, branch; set consent)
            SV->>R: save(experience)
            R->>DB: rpc submit_experience(...) in ONE transaction
            Note over DB: resolve company by slug/alias, else create pending<br/>insert experience, rounds, questions<br/>CHECK consent, status = pending
            DB-->>R: id
            R-->>SV: id
            SV-->>C: SubmitResult(id, status=pending)
            C-->>U: Success screen
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

Transition rules live in `Experience` methods and are repeated as a database CHECK on allowed transitions where practical. The diagram and the code must match: any new transition is added here first.
