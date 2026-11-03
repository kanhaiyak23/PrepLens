# 1. Requirement Analysis

**Why this document exists first:** every later artefact (classes, schema, API) must trace back to a requirement. A class with no requirement behind it is speculative design; a requirement with no class is a gap.

## 1.1 Problem statement

NST students preparing for a placement interview cannot find what each round actually asks. Experiences live in chat groups and are lost. PrepLens is a public, moderated archive of interview experiences written by seniors, plus an AI preparation guide grounded in those experiences.

Anti-goals (keep the scope shippable): not a job board, not a DSA practice site, not a discussion forum (no comments), not a referral network.

## 1.2 Actors

| Actor | Who | Authenticated | Can |
|---|---|---|---|
| Visitor | Anyone on the internet | No | Read published experiences, company pages, AI guides |
| Student | Holder of an `@nst.rishihood.edu.in` Google account | Yes | Everything a visitor can, plus post, edit and withdraw own posts, vote, bookmark, report, delete account |
| Admin | Student with `role = admin` | Yes | Everything a student can, plus moderate |
| Google (external) | OAuth identity provider | n/a | Authenticates users |
| Gemini (external) | LLM service | n/a | Generates structured guide text |

## 1.3 Functional requirements

IDs are referenced by tests and diagrams.

**Browse (Visitor)**
- FR-01 List published experiences, newest first, with cursor pagination.
- FR-02 Search by company and by text.
- FR-03 Filter by role, outcome, year and campus.
- FR-04 View one experience with its rounds and questions in order.
- FR-05 View a company page listing its published experiences.
- FR-06 View an AI preparation guide for a company, with citations to source experiences.

**Identity (Student)**
- FR-10 Sign in with Google; only `nst.rishihood.edu.in` accounts are accepted.
- FR-11 Complete a profile (graduation batch, branch) after first sign-in.
- FR-12 Delete own account, choosing to delete or detach (keep, forced anonymous) published posts.

**Contribute (Student)**
- FR-20 Submit an experience by quick form (company, role, outcome, free text) or by round-by-round form.
- FR-21 Mark a submission anonymous.
- FR-22 Give explicit publish consent before submitting.
- FR-23 Suggest a new company when none matches; it starts pending.
- FR-24 Edit own live experience; changes wait for admin approval while readers still see the approved version.
- FR-25 Update the interview outcome later; same review path.
- FR-26 Withdraw (unpublish) own experience instantly, and republish it.

**Interact (Student)**
- FR-30 Upvote and remove an upvote; at most one per user per experience.
- FR-31 Bookmark and un-bookmark; visible only to the owner.
- FR-32 Report an experience with a reason.

**Moderate (Admin)**
- FR-40 Approve or reject a pending submission, with a note on rejection.
- FR-41 Approve or reject a pending update.
- FR-42 Remove and reinstate a published experience.
- FR-43 Dismiss or action a report.
- FR-44 Approve, reject or merge a pending company.
- FR-45 Post an experience on behalf of a student (with their consent).
- FR-46 Every admin action writes an append-only log entry.

## 1.4 Non-functional requirements

Targets marked (A) are assumptions to be confirmed.

| ID | Quality | Requirement | Measured by |
|---|---|---|---|
| NFR-01 | Security | Public users can read only `published` rows; no role or user id is trusted from the browser | RLS tests as anon, student, other student, admin |
| NFR-02 | Privacy | An anonymous post exposes batch only; no name, id, avatar or branch in any public payload | Payload test on every public read path |
| NFR-03 | Integrity | One vote and one bookmark per user per experience, even under concurrent requests | Parallel-request test; DB unique constraint |
| NFR-04 | Auditability | Moderation history cannot be edited or deleted | Attempted UPDATE/DELETE fails |
| NFR-05 | Performance | Public feed server response under 500 ms p95 (A); every list query uses an index | `EXPLAIN` shows index scan, no seq scan |
| NFR-06 | Availability | Reads keep working if Gemini is down | Guide failure degrades only the guide panel |
| NFR-07 | Scalability | Correct at the current scale (hundreds of users, thousands of rows) with a documented path to more | Scale ladder in decisions |
| NFR-08 | Fairness | Rate limits keyed per user, not per IP (campus Wi-Fi shares one IP) | Rate-limit test with two users, one IP |
| NFR-09 | Compliance | Explicit consent recorded before publishing; author can withdraw at any time | `consented_at` constraint test |
| NFR-10 | Accessibility | Keyboard operable, WCAG AA contrast, reduced-motion respected | Playwright + manual checks |
| NFR-11 | Maintainability | Layered code; business logic never inside UI components | Code review against `07-api-design.md` |
| NFR-12 | Responsiveness | No horizontal overflow from 320 px to 1440 px | Playwright at 5 widths |

## 1.5 Use cases

| ID | Use case | Actor | Main flow (summary) | Key alternate / failure flows |
|---|---|---|---|---|
| UC-01 | Browse and filter archive | Visitor | Open archive, apply filters, load more | Empty result; invalid cursor |
| UC-02 | View experience | Visitor | Open detail, read rounds | Not published and not owner/admin returns 404 |
| UC-03 | View AI guide | Visitor | Open company, request guide | Not enough experiences; Gemini unavailable; cached guide used |
| UC-04 | Sign in | Student | Google OAuth, domain check, profile created | Non-NST email rejected with explanation |
| UC-05 | Complete profile | Student | Choose batch and branch | Invalid branch |
| UC-06 | Submit experience | Student | Fill form, consent, submit, status pending | Validation errors; daily limit; unknown company becomes pending |
| UC-07 | Edit / update result | Student | Edit live post, change waits for approval | Edit while a previous update is pending |
| UC-08 | Withdraw / republish | Student | Unpublish instantly | Republish goes back through review |
| UC-09 | Vote / bookmark | Student | Toggle | Double tap; concurrent requests |
| UC-10 | Report | Student | Choose reason | Duplicate open report by same user |
| UC-11 | Review submission | Admin | Approve or reject with note | Two admins act at once; already decided |
| UC-12 | Remove / reinstate | Admin | Soft remove, log entry | Already removed |
| UC-13 | Manage companies | Admin | Approve, reject, merge | Merge target missing; slug collision |
| UC-14 | Post on behalf | Admin | Enter content and student name, consent flag | No consent, so it stays unpublished |
| UC-15 | Delete account | Student | Choose keep or delete posts | Admin cannot self-delete |
