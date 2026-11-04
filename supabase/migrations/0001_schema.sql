-- 0001_schema: tables, constraints, indexes. See docs/design/08-database-schema.md.
-- Business rules live in constraints where possible (ADR-02, ADR-18).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null check (char_length(full_name) between 1 and 120),
  avatar_url text,
  graduation_batch int check (graduation_batch between 2000 and 2100),
  branch text check (branch in ('CSE','CSE-AI','CSE-DS','ECE','Other')),
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now()
);

-- Emails promoted to admin when their profile is created. Written by the service role / SQL only.
create table public.admin_emails (
  email text primary key check (email = lower(email))
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_lower text not null,
  aliases text[] not null default '{}',
  status text not null default 'active' check (status in ('active','pending')),
  experience_count int not null default 0 check (experience_count >= 0),
  created_at timestamptz not null default now()
);
create index companies_name_prefix on public.companies (name_lower text_pattern_ops);

create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  company_slug text not null,
  company_name text not null,
  author_id uuid references public.profiles (id) on delete set null,
  author_name text check (char_length(author_name) <= 120),
  author_batch int check (author_batch between 2000 and 2100),
  author_branch text check (author_branch in ('CSE','CSE-AI','CSE-DS','ECE','Other')),
  is_anonymous boolean not null default false,
  role text not null check (char_length(role) between 1 and 80),
  drive_type text not null check (drive_type in ('on-campus','off-campus','referral')),
  interview_year int not null check (interview_year between 2000 and 2100),
  interview_month int check (interview_month between 1 and 12),
  outcome text not null check (outcome in ('selected','rejected','in-process','withdrew')),
  campus text not null default 'ru' check (campus in ('ru','bangalore','hyderabad','pune')),
  status text not null default 'pending' check (status in ('pending','published','rejected','unpublished','removed')),
  source text not null default 'submitted' check (source in ('submitted','imported','admin')),
  consented_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (char_length(review_note) <= 1000),
  pending_update jsonb,
  update_review_note text check (char_length(update_review_note) <= 1000),
  upvote_count int not null default 0 check (upvote_count >= 0),
  search_tsv tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- ADR-18: consent is structural. No code path can publish without it.
  constraint published_requires_consent check (status <> 'published' or consented_at is not null)
);
-- Feed and company feed (keyset pagination, ADR-08): equality columns first, then sort columns.
create index exp_feed on public.experiences (status, created_at desc, id desc);
create index exp_company_feed on public.experiences (status, company_slug, created_at desc, id desc);
create index exp_campus_feed on public.experiences (status, campus, created_at desc, id desc);
create index exp_interview_feed on public.experiences (status, interview_year desc, interview_month desc nulls last, id desc);
create index exp_author on public.experiences (author_id, created_at desc);
create index exp_company_id on public.experiences (company_id);
create index exp_search on public.experiences using gin (search_tsv);

create table public.interview_rounds (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences (id) on delete cascade,
  position int not null check (position >= 1),
  name text not null check (char_length(name) between 1 and 120),
  tips text check (char_length(tips) <= 4000),
  unique (experience_id, position)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.interview_rounds (id) on delete cascade,
  position int not null check (position >= 1),
  text text not null check (char_length(text) between 1 and 2000),
  topic text check (char_length(topic) <= 60),
  unique (round_id, position)
);
create index questions_topic on public.questions (topic) where topic is not null;

-- ADR-07: the primary key is the rule "one vote per user per experience".
create table public.votes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  experience_id uuid not null references public.experiences (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, experience_id)
);
create index votes_experience on public.votes (experience_id);

create table public.bookmarks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  experience_id uuid not null references public.experiences (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, experience_id)
);
create index bookmarks_recent on public.bookmarks (user_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences (id) on delete cascade,
  reporter_id uuid references public.profiles (id) on delete set null,
  reason text not null check (reason in ('interviewer-named','confidential','false','abusive','other')),
  note text check (char_length(note) <= 1000),
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index reports_one_open_per_reporter on public.reports (reporter_id, experience_id) where status = 'open';
create index reports_queue on public.reports (status, created_at);
create index reports_experience on public.reports (experience_id);

-- ADR-10: append only (enforced by trigger in 0002 and by having no write grants).
create table public.moderation_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('approve','reject','approve-update','reject-update','post-on-behalf','remove','reinstate','dismiss-report')),
  experience_id uuid references public.experiences (id) on delete set null,
  admin_id uuid not null references public.profiles (id) on delete restrict,
  report_id uuid references public.reports (id) on delete set null,
  company_name text,
  role text,
  created_at timestamptz not null default now()
);
create index modlog_experience on public.moderation_logs (experience_id, action, created_at desc);
create index modlog_admin on public.moderation_logs (admin_id);

create table public.company_guides (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies (id) on delete cascade,
  fingerprint text not null,
  content jsonb not null,
  source_ids uuid[] not null default '{}',
  model text,
  generated_at timestamptz not null default now()
);

-- ADR-11: shared rate-limit state for a stateless API tier.
create table public.rate_limits (
  key text not null,
  action text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, action, window_start)
);
