# 4. Object-Oriented Design and SOLID

Rule for this project: **an abstraction is allowed only if it removes a real conditional or isolates a real dependency.** Each row below names the actual place it is applied so it can be pointed at in the evaluation.

## 4.1 The four OOP pillars

| Pillar | Where applied | Why it matters here |
|---|---|---|
| **Abstraction** | `ExperienceRepository`, `LlmClient`, `RateLimiter` interfaces hide Supabase, Gemini and Postgres details | Services state *what* they need, not *how*; storage and vendors can change |
| **Encapsulation** | `Experience` owns its state machine: `status` changes only through `publish()`, `unpublish()`, `remove()` and so on, which reject illegal transitions. `Experience.toPublic()` is the only way to produce a client-safe object | Invariants (consent before publish, anonymity) live in one place, not in every caller |
| **Inheritance** | `Submission` (abstract) with `QuickSubmission` and `DetailedSubmission`; `AppError` with its subclasses | Shared validation and conversion in the base; only the round-normalising step varies. Error subclasses share code and HTTP mapping |
| **Polymorphism** | `AuthorVisibility` (three implementations), `ModerationCommand` (five), `FeedSort` (two) | Callers call one method; the right behaviour is chosen by the object, so there is no growing `switch` |

Composition is preferred over inheritance elsewhere: policies and services are composed from small collaborators passed in through constructors.

## 4.2 SOLID, with locations

### S: Single Responsibility
A class has one reason to change.
- `SubmissionService` orchestrates a submission; it does not validate shapes (Zod schema), persist (repository), or limit rates (limiter).
- `ModerationService` runs commands; each `*Command` knows one decision.
- `GuideService` coordinates; prompt building, citation filtering and fingerprinting are separate small functions.
- Controllers only parse input, call a service and map errors; no business rules.

### O: Open/Closed
Open for extension, closed for modification.
- New moderation decision (for example "request changes"): add a `ModerationCommand` class; `ModerationService.execute()` is untouched.
- New feed ordering: add a `FeedSort` implementation; the repository query builder is untouched.
- New submission style: add a `Submission` subclass and register it in the factory.

### L: Liskov Substitution
Subtypes must be usable wherever the base is expected, without surprises.
- `QuickSubmission` and `DetailedSubmission` both return a normalised, valid list of rounds from `normaliseRounds()`; neither weakens the base postconditions, so `SubmissionService` treats them identically.
- Any `LlmClient` (Gemini, the fallback decorator, a test fake) returns parsed JSON or throws `LlmError`; none returns partial text.
- Any `AuthorVisibility` returns a `PublicAuthor` that never contains an email, id or branch for the anonymous case. A subclass that leaked identity would break substitution, which is why `AnonymousAuthor` is covered by a payload test.

### I: Interface Segregation
Clients should not depend on methods they do not use.
- Repositories are split by purpose: `ExperienceRepository` (read/write posts), `InteractionRepository` (votes, bookmarks), `ModerationLogRepository` (append only; it has **no** update or delete method, so misuse does not compile), `GuideRepository`.
- `RateLimiter` has one method (`consume`). A service that only limits does not see storage details.
- Read-only pages receive a `ExperienceReader` view of the repository, not the write methods.

### D: Dependency Inversion
High-level modules depend on abstractions; details depend on abstractions too.
- Services import interfaces from the domain layer; `Supabase*Repository`, `GeminiClient` and `PostgresRateLimiter` implement them.
- Concrete classes are created in a single composition root (`container`), the only place that knows about Supabase or Gemini. Tests build the same services with in-memory fakes.

## 4.3 Cohesion and coupling checks (use in code review)

- A file that imports both `next/*` and a domain rule is a smell: split it.
- A service constructor with more than about four dependencies is probably doing two jobs.
- A repository method that returns UI-shaped data belongs in a read model, not the repository.
- Any `if (type === ...)` chain on a domain concept should be questioned: is a polymorphic object missing?

## 4.4 Honest limits

TypeScript in a Node/Express app still favours functions and modules. We use classes where state plus behaviour belong together (`Experience`, commands, errors, services) and plain functions for pure helpers (cursor encode/decode, fingerprinting). The diagrams in `03` list exactly the classes that will exist; anything not listed there is not a class.
