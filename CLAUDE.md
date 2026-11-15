# PrepLens — CLAUDE.md

**Read this whole file before changing anything in this repo.** Sections marked VERIFIED were checked against real files or tools. Sections marked PLANNED are decisions not yet built; do not describe them as existing. Anything marked ASSUMPTION is a default awaiting the owner's confirmation.

Status: **context discovery done, awaiting owner approval. No implementation has started.** Do not begin frontend, schema, migration or backend work until the owner approves this file and the plan.

## 1. Product

PrepLens is a community archive of campus placement interview experiences for NST students: written by seniors, for juniors. It is being built **fresh, as a new codebase**. It is not a fork or port of any existing repo.

Job to be done: a student with an interview in nine days finds what each round actually asks, from someone who sat in it.

Anti-goals: not a job board, not a DSA practice site, not a discussion forum (no comments or threads), not a referral network.

## 2. Verified facts

- `apps/web` exists: Next.js 16 (App Router, TypeScript, Tailwind 4). Home page (`/`) plus working pages calling the API: `/signin` (Google via Supabase Auth), `/auth/callback`, `/profile` (batch, branch, sign out, delete; `/welcome` redirects here), `/archive` (server-rendered, URL filters, keyset paging), `/experience/[id]` (server-rendered; owner/admin fallback fetches with the token), `/submit` (quick or round-by-round, consent sentence), `/me` (my posts and saved), `/admin` (moderation queue). Client auth: `@supabase/ssr` browser client + `proxy.ts` session refresh; every API call sends the access token as a Bearer header. Env: `apps/web/.env.local` (public values only, gitignored). Libraries: @supabase/ssr, @supabase/supabase-js (gsap, three and motion were removed). **The UI is built from the owner's Stitch project `3022551661059433556` (ADR-28): tokens in `globals.css`, primitives in `components/ui/`, `Design source:` comments say which screen each component copies. Stitch MCP is registered at user scope (`stitch`, needs a restart of Claude Code to load).**
- Monorepo (npm workspaces): root `package.json` with `apps/*` and `packages/*`.
  - `packages/shared` (`@preplens/shared`): Zod schemas, enums, response types, error codes. Built with `tsc` to `dist`; build it before running or testing the API (the root scripts do).
  - `apps/api` (`@preplens/api`): Express 5 in plain JavaScript (ES modules, ADR-27; ports are JSDoc typedefs in `domain/ports.js`). Folders: `config/`, `domain/` (errors, ports, viewer, context), `infrastructure/` (Supabase adapters, rate limiter, repository factory), `services/`, `controllers/`, `routes/`, `middleware/`, `lib/`, plus `container.js` (composition root), `app.js` (no listen), `server.js`.
  - Built so far: health check, request id, error envelope, bearer-token auth (Supabase `auth.getUser`, role read from the DB each request), `requireRole`, `validate`, user-keyed `rateLimit`, cache headers. Routes: `GET /experiences`, `GET /experiences/:id`, `GET /companies`; `POST /experiences` (5/day), `POST /experiences/:id/unpublish|republish`, `PUT|DELETE /experiences/:id/vote|bookmark` (60/min), `POST /experiences/:id/reports` (10/day); `GET|PATCH /me`, `GET /me/experiences|bookmarks|interactions`; admin `GET /admin/experiences?status=` and `POST /admin/experiences/:id/{approve|reject|remove|reinstate}`. Also: `GET /companies/:slug/guide` (AI guide: Gemini adapter, fallback decorator, fingerprint cache, grounding; verified live with `gemini-2.5-flash`; needs GEMINI_API_KEY, otherwise 503) and admin company approve/merge. Also: `PATCH /experiences/:id` (edit or result update; a live post queues for review), `DELETE /me?posts=keep|delete`, admin updates queue, reports queue, post on behalf. All functional requirements are now built.
  - Tests: 94 passing (API) plus repeatable database tests in `supabase/tests/` (see its README) (`vitest` + `supertest`, fakes only, no database). A manual smoke test against the real Supabase project also passed.
  - `apps/api/.env` is local and gitignored. It holds the publishable key; the **service-role key is still a placeholder** and must be pasted from the Supabase dashboard before any feature that uses the rate limiter.
  - `apps/web/package-lock.json` is a leftover from before the workspace; the root `package-lock.json` is the real one.
- Tool config: `.claude/settings.local.json`, `.impeccable/config.local.json`, `.mcp.json`.
- Git: initialised on `main`, remote `origin` = `https://github.com/kanhaiyak23/PrepLens` (private). The remote holds only a LICENSE and README (one "Initial commit"). Nothing committed or pushed locally yet.
- `.mcp.json` registers the Supabase MCP server (`https://mcp.supabase.com/mcp`, http); it is authenticated and enabled in `.claude/settings.local.json`.
- Supabase org: `kanhaiyak23's Org`. Existing projects: `microgreen` (active, unrelated, do not touch) and `kanhaiyak23's Project` (inactive, created 2025, unrelated). **No PrepLens project exists yet.**
- No MongoDB data is to be migrated. The product starts empty.
- Supabase project `PrepLens` exists: ref `hygafqegwxnrfnhsxmgq`, region ap-south-1, org `kanhaiyak23's Org` (Free plan). Public URL: `https://hygafqegwxnrfnhsxmgq.supabase.co`. Migrations 0001 to 0012 are applied (0010 sort by interview date, 0011 test-email allowlist, 0012 second test address, ADR-26: two non-college test addresses are allowed beside the domain rule; remove before real launch) (0007 guide sources, 0008 company approve/merge, 0009 edit/update queue, account deletion, post on behalf, reports queue) and saved in `supabase/migrations/`; behaviour and tests are in `docs/design/08-database-schema.md` §8.7 and ADR-25. Google OAuth and the college-domain restriction at the provider level are configured in the Supabase dashboard (not yet done); the domain rule itself is enforced by a database trigger on `auth.users`. `admin_emails` holds `kanhaiya.k23csai@nst.rishihood.edu.in`; Google sign-in works end to end and that profile exists as admin (batch 2027, CSE-AI). The `moderation_logs` table keeps 3 rows from end-to-end testing (company name "TEST Example Co"); it is append-only by design.

## 3. Reference only: the original PrepLens (not our code)

An earlier PrepLens by another author exists (Express + MongoDB + Vite). It is a **behavioural reference**, not source to copy. Do not copy its code, copy text, docs or branding. Re-derive behaviour independently. Rules worth matching, because they are product rules rather than implementation:

- Public read of published experiences only; sign in with an NST Google account to post.
- Anonymous posts show **batch only** (never branch) and must not leak identity in any payload, enforced server-side, not in the UI.
- Outcome is an enum (`selected | rejected | in-process | withdrew`), not a boolean.
- Authors can unpublish instantly; account deletion lets the user delete their posts or keep them detached and forced anonymous.
- Votes and bookmarks are unique per user and experience; bookmarks are private.
- Admin actions are authorised server-side and written to an append-only moderation log.
- Posts go through admin review; edits and result updates to a live post wait for approval while readers keep seeing the approved version.
- Companies are a normalised table (slug, aliases, pending/active); new unknown companies start pending.
- Campus field exists (`ru`, `bangalore`, `hyderabad`, `pune`); students post only `ru`, admins post for others.
- Admins can post on a student's behalf with the student's consent.
- AI company prep guide: structured JSON from Gemini, every round and tip cites source experiences by number, invalid citations are dropped, counts and top topics are computed in code (never generated), cached per company and invalidated by a fingerprint of source experiences.
- Cursor (keyset) pagination, never offset.
- Rate limits keyed on user id for signed-in actions, not IP (campus wifi shares one IP).

## 4. Target architecture (PLANNED)

Monorepo (ASSUMPTION: npm workspaces) with two deployables and one shared package (ADR-21, ADR-24):

- `apps/web`: Next.js App Router, React, TypeScript, Tailwind CSS, Motion, shadcn/ui primitives where useful, Lucide icons. **Presentation only**: no business rules, no service-role key.
- `apps/api`: **Node.js + Express (JavaScript, ADR-27)**, versioned REST API at `/api/v1`. Owns all business logic, authorisation, rate limiting and the Gemini call. Layers: routes → controllers → services → repositories, with domain and infrastructure folders (layout in `docs/design/07-api-design.md`). Tests with `supertest`.
- `packages/shared`: Zod schemas, enums, DTO types, error codes used by both apps.
- **Data and identity:** Supabase Postgres, Supabase Auth (Google OAuth), Row Level Security, Storage only if needed.
- **AI:** Google Gemini, called only from the API.
- **Validation:** Zod on every API boundary.
- **Testing:** Playwright CLI (UI), `supertest` + Vitest (API and services), SQL tests (RLS and constraints), `tsc`, ESLint.
- **Hosting (ASSUMPTION):** web on Vercel; the API on a Node host (Render or Railway; open question, a free tier sleeps and cold-starts); Supabase cloud. No custom domain yet.
- **Auth flow:** the web app signs in through Supabase Auth; every API call carries `Authorization: Bearer <access token>`; the API verifies it and loads the role from the database (ADR-22). CORS allows only the web origin, never `*`.

Exact versions, scripts and file contents are decided during setup and recorded here then. Do not invent them now.

## 5. Database (PLANNED)

Tables: `profiles`, `companies`, `experiences`, `interview_rounds`, `questions`, `votes`, `bookmarks`, `reports`, `moderation_logs`, plus `company_guides` (AI cache) and `rate_limits` if needed. Add others only with a stated reason.

Required constraints and rules:

- UUID primary keys; `profiles.id` references `auth.users`.
- Unique `(user_id, experience_id)` on votes and bookmarks; the constraint, not app code, is what prevents double votes.
- Check constraints on enums (outcome, status, drive type, campus, report reason).
- Rounds and questions are real tables with an explicit position column.
- Author batch/branch are snapshotted on the experience at submit time.
- `moderation_logs` is append-only, enforced by RLS plus a trigger that rejects UPDATE and DELETE.
- Consent: an experience cannot be `published` without `consented_at`.
- Indexes only for named queries (feed, company feed, author, search, moderation queue); keyset index includes the id tiebreak.
- Full-text search via Postgres `tsvector`; decide the config at Phase 2.
- Anonymous authorship must not be recoverable from any public view or RLS-readable column. Expose public data through views/functions that omit identity columns.

## 6. Auth and security (PLANNED, non-negotiable)

- Supabase Auth with Google OAuth. Allowed email domain: **`nst.rishihood.edu.in`**, enforced **server-side** (an auth hook or database trigger that rejects other domains), never only in the frontend. Compare the exact domain after the last `@`; reject lookalikes such as `nst.rishihood.edu.in.evil.com`.
- Admin is a role on `profiles`, never a shared login. Admin emails come from a server-side allowlist (ASSUMPTION: an `ADMIN_EMAILS` env var in the API / config table). Never trust a role or user id sent by the browser; the API derives both from the verified token and the database.
- The Supabase **service-role key lives only in the API's server environment** (never in `apps/web`, never in client code, never committed) and is used only for the short list in `docs/design/08-database-schema.md` §8.6. Other database access runs as the calling user so RLS applies (ADR-23). Only `NEXT_PUBLIC_` values that are meant to be public may be exposed by the web app.
- Every table has RLS enabled. Public users read only `published` experiences. Run the Supabase security advisor after every migration.
- No secrets, keys or credentials in this file, in the repo, or in commits. Env var *names* are documented in `.env.example` once it exists.
- Show the consent sentence directly above the submit button: "This will be publicly visible on the internet, including to recruiters and search engines. You can unpublish it at any time."
- No interviewer names, no verbatim confidential question sets, no compensation of others.

## 7. Supabase conventions

- Use the Supabase MCP. Inspect existing tables before any schema change.
- All schema changes are migrations (`apply_migration`), kept as SQL files in the repo; no ad hoc DDL through `execute_sql`.
- Never run destructive SQL (drop, truncate, mass delete) without explicit owner approval.
- Prefer a Supabase branch for risky changes. Check cost before creating a project or branch and ask the owner.
- Generate TypeScript types after each schema change.
- Web app: official `@supabase/ssr` pattern (browser and server clients, cookie-based session) for sign-in only.
- API: a user-scoped Supabase client per request built from the caller's token; a separate service-role client only for the listed system tasks (ADR-23).

## 8. Design direction (VERIFIED, owner-supplied)

The design is the owner's Stitch project `3022551661059433556` (8 screens: Home, Sign in, Experiences, Experience detail, Share your interview, My posts, Profile, Admin moderation). It replaces the earlier "aperture" proposal, the vermilion/paper palette and the serif display font, and it supersedes the old "no violet" rule: the palette is violet (primary `#4f378a`), the font is Public Sans, icons are Material Symbols, radii are small. All values live in `apps/web/src/app/globals.css` (`@theme`); change them there only. Decisions and the list of things deliberately left out of the mock (anything with no real data) are in ADR-28.

**Rules that still apply:** every screen shows real content (no fake stats; empty states are designed instead); anonymous authors render as `Anonymous · <batch>` only; the consent sentence sits directly above the submit button.

## 9. Motion principles (PLANNED, on hold: the Stitch design has no motion)

- Animate only to explain state, order or causality: entrance of a list (short stagger), route change, round timeline reveal, count-up of real numbers, tab/filter transitions, button press feedback.
- Use transform and opacity only; keep durations short and eased; interactions are interruptible.
- Honour `prefers-reduced-motion`: everything rests and nothing stays hidden.
- Prefer CSS and Server Components; use client JS for motion only where needed.
- No scroll-jacking, parallax on text, or random looping.

## 10. Skills and when to use them (VERIFIED installed)

Announce which skill you are using, and why, before each major phase. Do not run all of them for every task.

- `design-taste-frontend`: art direction and anti-slop gate. It is aimed at marketing sites; use its principles and checks for the public landing page, not as a build pipeline for the app UI.
- `frontend-design:frontend-design`, `ui-ux-pro-max`: overall visual direction, tokens, components, typography and colour (Phase 1, 3, 4).
- `impeccable`: design critique, audit and polish passes. Its hook config is in `.impeccable/`.
- `emil-design-eng`, `animate`: how animations should feel, and building them (Phase 5).
- `improve-animations`: audit of motion quality and performance (Phase 5, read-only planning).
- `playwright-cli`: real-browser testing at 1440, 1024, 768, 390 and 320 (Phase 6).
- `ui-styling`: Tailwind and shadcn/ui setup and theming.
- `dataviz`: charts and analytics views.
- `code-review`, `security-review`, `simplify`: before merging significant work.
- Supabase agent skill (`npx skills add supabase/agent-skills`) is suggested by the Supabase MCP; not installed. Ask the owner before installing.

## 11. MCP and tools

- **Supabase MCP (VERIFIED, authenticated):** list/inspect tables, apply migrations, run SQL, security and performance advisors, logs, TypeScript types, edge functions, branches, docs search.
- **Playwright CLI:** via the `playwright-cli` skill. Chrome tools (`claude-in-chrome`, `chrome-devtools`) also exist for inspection.
- `gh` CLI is authenticated as `kanhaiyak23`.

## 12. Testing and quality (PLANNED)

- After every phase: `tsc --noEmit`, ESLint, and the relevant tests, with output reported honestly.
- API: `supertest` against the Express `app` (imported without listening) for every endpoint: success, validation failure, auth failure, role failure, rate limit.
- Playwright: check 1440, 1024, 768, 390 and 320 for horizontal overflow, broken navigation and forms, console errors; then fix and re-check.
- Database tests: RLS as anon, as a student, as another student and as admin; anonymous privacy; one vote per user; private bookmarks; append-only log; domain restriction.
- Verify AI citations map to real experiences.

## 13. Build, lint and dev commands

From the repo root: `npm install`; `npm test` (builds shared, runs API tests); `npm run typecheck` (shared package only; the API has no type step); `npm run dev:api` (API on port 4000, needs `apps/api/.env`); `npm run dev:web` (landing page). Web alone: `cd apps/web && npm run dev -- -p 3100`.

## 14. Implementation sequence (PLANNED)

Phase 0 context and approval → 1 design system → 2 Supabase foundation (schema, RLS, auth config, types) → 3 Express API foundation (monorepo, layers, middleware, auth, error envelope, composition root, health check) → 4 Next.js foundation (layouts, nav, auth pages) → 5 product features, each built API-first then UI (archive, company pages, detail, search/filter, submit, student dashboard, votes and bookmarks, admin, AI guides) → 6 motion and refinement → 7 testing and QA. Verify each phase before starting the next. Never skip the approval gate.

## 15. Design documentation (capstone LLD evaluation)

This is a final-year capstone evaluated on Low-Level Design. Design documents live in `docs/design/` (index: `docs/design/README.md`): requirements, decision records, class diagrams, OOP and SOLID, patterns, sequence/activity/state diagrams, API design, database schema, errors and concurrency.

Rules:
- **Every design decision gets a record in `docs/design/02-decisions.md`** with Problem, Decision, Why (the named system design concept), and Rejected alternatives and trade-offs. When explaining a choice to the owner, name the concept and the reason, not just the choice.
- **Design is the contract.** Code must match the class diagram, API contract and schema. If implementation needs to diverge, update the document first (or in the same change) and record why. Do not let diagrams rot.
- Add a class, pattern or table only if it appears in the docs and is justified there. Patterns are justified by the problem they solve here (see `05-design-patterns.md`, including the rejected list).
- Each concurrency or privacy claim needs a test that fails when its defence is removed.
- Keep SOLID visible: say where each principle is applied when adding a service or interface.

Domain model classes (used by running code, tested): `ExperienceLifecycle`, `FeedSort`, `AuthorVisibility`, `Submission`, `ModerationCommand`, `CompanyGuide` in `apps/api/src/domain/`. The class diagram (`docs/design/03`) is rewritten to match: the entity model is the database. Concurrency check against a running stack: `apps/api/scripts/concurrency-check.mjs` (see its header). Design compliance is audited in `docs/design/10-compliance.md`. Re-run that audit (layering greps, service-role usage, class-diagram coverage) before the evaluation and whenever a layer is touched.

## 16. Working rules

- Keep business logic out of UI components. Prefer Server Components for data-heavy pages; Client Components only for interactivity.
- Avoid unnecessary dependencies and duplicated logic.
- Never silently drop a feature, disable security to make something work, or make destructive database changes without approval.
- Commit and push only when the owner asks. Keep temporary task notes out of this file.
- Update this file when a PLANNED item becomes real or a decision changes.
