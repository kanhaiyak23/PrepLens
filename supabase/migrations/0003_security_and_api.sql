-- 0003: RLS, grants and the functions the API calls. See docs/design/08 (§8.4) and ADR-04, ADR-06, ADR-14, ADR-23.
-- Error convention: functions raise P0001 with a message "CODE: text"; the API maps CODE to its error classes.

alter table public.profiles enable row level security;
alter table public.admin_emails enable row level security;
alter table public.companies enable row level security;
alter table public.experiences enable row level security;
alter table public.interview_rounds enable row level security;
alter table public.questions enable row level security;
alter table public.votes enable row level security;
alter table public.bookmarks enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_logs enable row level security;
alter table public.company_guides enable row level security;
alter table public.rate_limits enable row level security;

-- Start from nothing, then grant the minimum (ADR-04).
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- Companies: anyone may read active ones. Writes happen only inside functions / service role.
grant select on public.companies to anon, authenticated;
create policy companies_read_active on public.companies for select to anon, authenticated using (status = 'active');

-- Profiles: a user reads their own row and edits only three columns. Role is not editable by users.
grant select on public.profiles to authenticated;
create policy profiles_read_self on public.profiles for select to authenticated using (id = auth.uid());
grant update (full_name, graduation_batch, branch) on public.profiles to authenticated;
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Experiences, rounds, questions, votes, bookmarks, reports, moderation_logs, company_guides, rate_limits, admin_emails:
-- RLS on and no policy and no grant. Reached only through the functions below (or the service role).

-- ---------------------------------------------------------------- rate limiting (ADR-11)
create function public.check_rate_limit(p_key text, p_action text, p_limit int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare c int;
begin
  insert into public.rate_limits as r (key, action, window_start, count)
  values (p_key, p_action, date_bin(make_interval(secs => p_window_seconds), now(), timestamptz 'epoch'), 1)
  on conflict (key, action, window_start) do update set count = r.count + 1
  returning r.count into c;
  return c <= p_limit;
end $$;
grant execute on function public.check_rate_limit(text, text, int, int) to service_role;

-- ---------------------------------------------------------------- reads (ADR-06: anonymity decided here, not in a UI)
create function public._author_json(p_anon boolean, p_author_id uuid, p_author_name text, p_batch int, p_branch text, p_consented timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case
    when p_anon or (p_author_id is null and (p_author_name is null or p_consented is null))
      then jsonb_build_object('anonymous', true, 'batch', p_batch)
    when p_author_id is null
      then jsonb_build_object('anonymous', false, 'name', p_author_name, 'batch', p_batch, 'branch', p_branch)
    else (select jsonb_build_object('anonymous', false, 'name', pr.full_name, 'batch', p_batch, 'branch', p_branch)
          from public.profiles pr where pr.id = p_author_id)
  end
$$;

create function public.list_experiences(
  p_company text default null, p_role text default null, p_outcome text default null,
  p_year int default null, p_campus text default null, p_q text default null,
  p_cursor_created timestamptz default null, p_cursor_id uuid default null, p_limit int default 20
) returns table (
  id uuid, company_name text, company_slug text, role text, drive_type text, interview_year int,
  interview_month int, outcome text, campus text, round_count int, upvote_count int,
  created_at timestamptz, updated_at timestamptz, author jsonb
) language sql stable security definer set search_path = '' as $$
  select e.id, e.company_name, e.company_slug, e.role, e.drive_type, e.interview_year,
         e.interview_month, e.outcome, e.campus,
         (select count(*)::int from public.interview_rounds r where r.experience_id = e.id),
         e.upvote_count, e.created_at, e.updated_at,
         public._author_json(e.is_anonymous, e.author_id, e.author_name, e.author_batch, e.author_branch, e.consented_at)
  from public.experiences e
  where e.status = 'published'
    and (p_company is null or e.company_slug = p_company)
    and (p_role is null or e.role = p_role)
    and (p_outcome is null or e.outcome = p_outcome)
    and (p_year is null or e.interview_year = p_year)
    and (p_campus is null or e.campus = p_campus)
    and (p_q is null or btrim(p_q) = '' or e.search_tsv @@ websearch_to_tsquery('english', p_q))
    and (p_cursor_created is null or (e.created_at, e.id) < (p_cursor_created, p_cursor_id))
  order by e.created_at desc, e.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 51)
$$;

create function public.get_experience(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.experiences; viewer uuid := auth.uid(); privileged boolean; res jsonb;
begin
  select * into e from public.experiences where id = p_id;
  if not found then return null; end if;
  privileged := (viewer is not null and e.author_id = viewer) or public.is_admin();
  if e.status <> 'published' and not privileged then return null; end if;
  res := jsonb_build_object(
    'id', e.id, 'company', jsonb_build_object('name', e.company_name, 'slug', e.company_slug),
    'role', e.role, 'drive_type', e.drive_type, 'interview_year', e.interview_year,
    'interview_month', e.interview_month, 'outcome', e.outcome, 'campus', e.campus,
    'upvote_count', e.upvote_count, 'created_at', e.created_at,
    'updated_at', case when e.updated_at > e.created_at then e.updated_at end,
    'author', public._author_json(e.is_anonymous, e.author_id, e.author_name, e.author_batch, e.author_branch, e.consented_at),
    'rounds', (select coalesce(jsonb_agg(jsonb_build_object(
        'position', r.position, 'name', r.name, 'tips', r.tips,
        'questions', (select coalesce(jsonb_agg(jsonb_build_object('text', q.text, 'topic', q.topic) order by q.position), '[]'::jsonb)
                      from public.questions q where q.round_id = r.id)) order by r.position), '[]'::jsonb)
      from public.interview_rounds r where r.experience_id = e.id));
  if privileged then
    res := res || jsonb_build_object('status', e.status, 'review_note', e.review_note, 'is_owner', e.author_id = viewer);
  end if;
  return res;
end $$;

create function public.list_my_experiences() returns table (
  id uuid, company_name text, role text, outcome text, status text, review_note text,
  interview_year int, upvote_count int, round_count int, created_at timestamptz
) language sql stable security definer set search_path = '' as $$
  select e.id, e.company_name, e.role, e.outcome, e.status, e.review_note, e.interview_year, e.upvote_count,
         (select count(*)::int from public.interview_rounds r where r.experience_id = e.id), e.created_at
  from public.experiences e where e.author_id = auth.uid() order by e.created_at desc, e.id desc limit 100
$$;

create function public.get_stats() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'published', (select count(*) from public.experiences where status = 'published'),
    'companies', (select count(*) from public.companies where status = 'active' and experience_count > 0))
$$;

-- ---------------------------------------------------------------- writes (ADR-14: one transaction each)
create function public.submit_experience(p_payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); prof public.profiles; cname text; cslug text; cid uuid; cdisplay text;
  eid uuid; r jsonb; q jsonb; rpos int := 0; qpos int; rid uuid; nrounds int;
begin
  if uid is null then raise exception 'UNAUTHENTICATED: Sign in to share an experience.' using errcode = 'P0001'; end if;
  select * into prof from public.profiles where id = uid;
  if not found or prof.graduation_batch is null or prof.branch is null then
    raise exception 'FORBIDDEN: Complete your profile (batch and branch) before posting.' using errcode = 'P0001';
  end if;
  if coalesce(p_payload ->> 'consent', '') <> 'true' then
    raise exception 'VALIDATION: You must agree to publish before submitting.' using errcode = 'P0001';
  end if;
  cname := btrim(coalesce(p_payload ->> 'company', ''));
  cslug := public.slugify(cname);
  if cslug = '' then raise exception 'VALIDATION: Company is required.' using errcode = 'P0001'; end if;
  nrounds := coalesce(jsonb_array_length(p_payload -> 'rounds'), 0);
  if nrounds < 1 or nrounds > 12 then raise exception 'VALIDATION: Add between 1 and 12 rounds.' using errcode = 'P0001'; end if;

  select c.id, c.name into cid, cdisplay from public.companies c
   where c.slug = cslug or lower(cname) = any (select lower(a) from unnest(c.aliases) a) limit 1;
  if cid is null then
    insert into public.companies (name, slug, name_lower, status) values (left(cname, 120), cslug, lower(left(cname, 120)), 'pending')
    on conflict (slug) do nothing returning id, name into cid, cdisplay;
    if cid is null then select c.id, c.name into cid, cdisplay from public.companies c where c.slug = cslug; end if;
  end if;

  insert into public.experiences (company_id, company_slug, company_name, author_id, author_batch, author_branch, is_anonymous,
      role, drive_type, interview_year, interview_month, outcome, campus, status, source, consented_at)
  values (cid, (select slug from public.companies where id = cid), cdisplay, uid, prof.graduation_batch, prof.branch,
      coalesce((p_payload ->> 'isAnonymous')::boolean, false),
      btrim(p_payload ->> 'role'), p_payload ->> 'driveType', (p_payload ->> 'interviewYear')::int,
      nullif(p_payload ->> 'interviewMonth', '')::int, p_payload ->> 'outcome', 'ru', 'pending', 'submitted', now())
  returning id into eid;

  for r in select * from jsonb_array_elements(p_payload -> 'rounds') loop
    rpos := rpos + 1;
    insert into public.interview_rounds (experience_id, position, name, tips)
    values (eid, rpos, btrim(r ->> 'name'), nullif(btrim(coalesce(r ->> 'tips', '')), '')) returning id into rid;
    qpos := 0;
    for q in select * from jsonb_array_elements(coalesce(r -> 'questions', '[]'::jsonb)) loop
      qpos := qpos + 1;
      insert into public.questions (round_id, position, text, topic)
      values (rid, qpos, btrim(q ->> 'text'), nullif(btrim(coalesce(q ->> 'topic', '')), ''));
    end loop;
  end loop;
  perform public.refresh_experience_search(eid);
  return eid;
end $$;

create function public.set_experience_visibility(p_id uuid, p_publish boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); v_to text; n int;
begin
  if uid is null then raise exception 'UNAUTHENTICATED: Sign in required.' using errcode = 'P0001'; end if;
  if p_publish then
    update public.experiences set status = 'pending', reviewed_by = null, reviewed_at = null
     where id = p_id and author_id = uid and status = 'unpublished' returning status into v_to;
  else
    update public.experiences set status = 'unpublished'
     where id = p_id and author_id = uid and status in ('published', 'pending') returning status into v_to;
  end if;
  get diagnostics n = row_count;
  if n = 0 then
    if exists (select 1 from public.experiences where id = p_id and author_id = uid)
      then raise exception 'CONFLICT: This experience cannot move to that state from where it is.' using errcode = 'P0001';
      else raise exception 'NOT_FOUND: Experience not found.' using errcode = 'P0001'; end if;
  end if;
  return v_to;
end $$;

create function public.moderate_experience(p_id uuid, p_action text, p_note text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); v_from text; v_to text; v_log text; v_company text; v_role text; n int;
begin
  if uid is null then raise exception 'UNAUTHENTICATED: Sign in required.' using errcode = 'P0001'; end if;
  if not public.is_admin() then raise exception 'FORBIDDEN: Admins only.' using errcode = 'P0001'; end if;
  case p_action
    when 'approve' then v_from := 'pending'; v_to := 'published'; v_log := 'approve';
    when 'reject' then v_from := 'pending'; v_to := 'rejected'; v_log := 'reject';
      if coalesce(btrim(p_note), '') = '' then raise exception 'VALIDATION: A note is required when rejecting.' using errcode = 'P0001'; end if;
    when 'remove' then v_from := 'published'; v_to := 'removed'; v_log := 'remove';
    when 'reinstate' then v_from := 'removed'; v_to := 'pending'; v_log := 'reinstate';
    else raise exception 'VALIDATION: Unknown moderation action.' using errcode = 'P0001';
  end case;
  -- Compare-and-set: only one admin can win a decision (ADR, 09 §9.4).
  update public.experiences set status = v_to, reviewed_by = uid, reviewed_at = now(),
         review_note = case when p_action = 'reject' then left(btrim(p_note), 1000) else null end
   where id = p_id and status = v_from returning company_name, role into v_company, v_role;
  get diagnostics n = row_count;
  if n = 0 then
    if exists (select 1 from public.experiences where id = p_id)
      then raise exception 'CONFLICT: This experience is no longer %.', v_from using errcode = 'P0001';
      else raise exception 'NOT_FOUND: Experience not found.' using errcode = 'P0001'; end if;
  end if;
  insert into public.moderation_logs (action, experience_id, admin_id, company_name, role) values (v_log, p_id, uid, v_company, v_role);
  if p_action = 'remove' then
    update public.reports set status = 'actioned', resolved_by = uid, resolved_at = now() where experience_id = p_id and status = 'open';
  end if;
  return v_to;
end $$;

-- ---------------------------------------------------------------- votes, bookmarks, reports (ADR-07: the constraint is the rule)
create function public.vote_experience(p_exp uuid, p_on boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cnt int;
begin
  if uid is null then raise exception 'UNAUTHENTICATED: Sign in to vote.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.experiences where id = p_exp and status = 'published') then
    raise exception 'NOT_FOUND: Experience not found.' using errcode = 'P0001';
  end if;
  if p_on then
    insert into public.votes (user_id, experience_id) values (uid, p_exp) on conflict do nothing;
  else
    delete from public.votes where user_id = uid and experience_id = p_exp;
  end if;
  select upvote_count into cnt from public.experiences where id = p_exp;
  return jsonb_build_object('voted', p_on, 'upvote_count', cnt);
end $$;

create function public.bookmark_experience(p_exp uuid, p_on boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'UNAUTHENTICATED: Sign in to bookmark.' using errcode = 'P0001'; end if;
  if p_on then
    if not exists (select 1 from public.experiences where id = p_exp and status = 'published') then
      raise exception 'NOT_FOUND: Experience not found.' using errcode = 'P0001';
    end if;
    insert into public.bookmarks (user_id, experience_id) values (uid, p_exp) on conflict do nothing;
  else
    delete from public.bookmarks where user_id = uid and experience_id = p_exp;
  end if;
  return jsonb_build_object('bookmarked', p_on);
end $$;

create function public.my_interactions(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'voted', coalesce((select jsonb_agg(v.experience_id) from public.votes v where v.user_id = auth.uid() and v.experience_id = any (p_ids)), '[]'::jsonb),
    'bookmarked', coalesce((select jsonb_agg(b.experience_id) from public.bookmarks b where b.user_id = auth.uid() and b.experience_id = any (p_ids)), '[]'::jsonb))
$$;

create function public.report_experience(p_exp uuid, p_reason text, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); rid uuid;
begin
  if uid is null then raise exception 'UNAUTHENTICATED: Sign in to report.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.experiences where id = p_exp and status = 'published') then
    raise exception 'NOT_FOUND: Experience not found.' using errcode = 'P0001';
  end if;
  begin
    insert into public.reports (experience_id, reporter_id, reason, note)
    values (p_exp, uid, p_reason, nullif(left(btrim(coalesce(p_note, '')), 1000), '')) returning id into rid;
  exception when unique_violation then
    raise exception 'CONFLICT: You already have an open report on this experience.' using errcode = 'P0001';
  end;
  return rid;
end $$;

-- Grants: public reads for everyone, everything else for signed-in users only.
grant execute on function public.list_experiences(text, text, text, int, text, text, timestamptz, uuid, int) to anon, authenticated;
grant execute on function public.get_experience(uuid) to anon, authenticated;
grant execute on function public.get_stats() to anon, authenticated;
grant execute on function public.list_my_experiences() to authenticated;
grant execute on function public.submit_experience(jsonb) to authenticated;
grant execute on function public.set_experience_visibility(uuid, boolean) to authenticated;
grant execute on function public.moderate_experience(uuid, text, text) to authenticated;
grant execute on function public.vote_experience(uuid, boolean) to authenticated;
grant execute on function public.bookmark_experience(uuid, boolean) to authenticated;
grant execute on function public.my_interactions(uuid[]) to authenticated;
grant execute on function public.report_experience(uuid, text, text) to authenticated;
