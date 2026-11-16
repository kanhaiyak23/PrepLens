# PrepLens: Design Documentation

Capstone evaluation maps to these files. **The design is the contract: code must match it exactly.** If code and a diagram disagree, one of them is a bug; fix it and record why in `02-decisions.md`.

Status: **accepted and implemented.** The design matches the running code (API in JavaScript per ADR-27; shared package and web in TypeScript). Compliance audit: `10-compliance.md`.

| \# | File | Evaluation criterion |
| --- | --- | --- |
| 1 | [01-requirements.md](01-requirements.md) | Requirement analysis: FR, NFR, actors, use cases |
| 2 | [02-decisions.md](02-decisions.md) | Design decisions, each with the system design concept and the *why* |
| 3 | [03-class-diagram.md](03-class-diagram.md) | Class diagrams: entity model (database), layers and ports, TypeScript domain model |
| 4 | [04-oop-and-solid.md](04-oop-and-solid.md) | OOP (abstraction, encapsulation, inheritance, polymorphism) and SOLID, with where each is applied |
| 5 | [05-design-patterns.md](05-design-patterns.md) | Patterns used, why each, and which were rejected |
| 6 | [06-sequence-and-activity.md](06-sequence-and-activity.md) | Sequence, activity and state diagrams for core use cases |
| 7 | [07-api-design.md](07-api-design.md) | Layers, method signatures, request/response contracts |
| 8 | [08-database-schema.md](08-database-schema.md) | Schema, keys, constraints, indexes, mapped from the class design |
| 9 | [09-errors-and-concurrency.md](09-errors-and-concurrency.md) | Validation, failure modes, edge cases, concurrency |
| 10 | [10-compliance.md](10-compliance.md) | Audit of the code against every decision, SOLID, patterns and the evaluation criteria, with gaps |
| 11 | Working implementation | `apps/api`, `apps/web`, `supabase/` (migrations and tests) |

## How every decision is written

Each decision in `02-decisions.md` answers four questions, in this order:

1. **Problem:** what forces the decision.
2. **Decision:** what we chose.
3. **Why (system design concept):** the named principle that justifies it.
4. **Rejected alternatives and trade-offs:** what we gave up. A decision with no cost is not a decision.

## Viva checklist

For each decision be able to say: the concept's name, the failure it prevents, and the cheapest test that proves it (for example, firing the same vote twice and showing the count stays 1).

## Open schedule question

The notice says the final evaluation is in the first week of November. Today's date in this session is 9 November 2026, so confirm the actual date and slot with the course team.