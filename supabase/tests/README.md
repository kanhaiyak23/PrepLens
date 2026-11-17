# Database tests

Each file is one `DO` block that builds its own data, asserts, and then **raises an exception on purpose** so everything it created is rolled back.
The message `RESULT: ...` is the report. Anything containing `FAIL` is a regression.

Run one against the project (Supabase MCP `execute_sql`, the SQL editor, or `psql`):

    psql "$DATABASE_URL" -f supabase/tests/001_rules.sql

They simulate sign-in with `set_config('request.jwt.claims', ...)` and switch roles with `set local role`, so they exercise the same
privileges and RLS the API sees. They never touch real rows.

| File | Proves |
|---|---|
| `001_rules.sql` | College-domain rule, profile + admin promotion, company dedupe, consent and future-date rejection, hidden pending posts, CAS moderation, anonymity in payloads, idempotent votes, append-only log, rate limiter, closed tables |
| `002_company_admin_and_guide.sql` | Company approve/merge (admin only, logged), guide sources include published posts only and anonymise authors |
| `003_query_plans.sql` | Feed queries use index-only scans with rows examined = rows returned on 20,000 rows (NFR-05) |
| `007_admin_roles.sql` | Only admins list, grant or revoke admin; the internal role function is not callable; email is normalised; no double grant; unknown email is NOT_FOUND; no self-removal; a revoked admin leaves `admin_emails` and loses power at once; both changes are logged with their subject; the log stays append-only. Needs migration `0013` |
