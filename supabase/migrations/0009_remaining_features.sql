-- 0009: edit and result update of a live post (review queue), account deletion, post on behalf, reports queue.
-- Same conventions as 0003: security definer, P0001 "CODE: text", EXECUTE revoked then granted explicitly (0004 lesson).

-- ---------------------------------------------------------------- shared internals (not granted to anyone)
create function public._replace_rounds(p_id uuid, p_rounds jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare r jsonb; q jsonb; rpos int := 0; qpos int; rid uuid;
begin
  if p_rounds is null or jsonb_typeof(p_rounds) <> 'array' or jsonb_array_length(p_rounds) not between 1 and 12 then
    raise exception 'VALIDATION: Add between 1 and 12 rounds.' using errcode = 'P0001';
  end if;
  delete from public.interview_rounds where experience_id = p_id;
  for r in select * from jsonb_array_elements(p_rounds) loop
    rpos := rpos + 1;
    insert into public.interview_rounds (experience_id, position, name, tips)
    values (p_id, rpos, btrim(r ->> 'name'), nullif(btrim(coalesce(r ->> 'tips', '')), '')) returning id into rid;
    qpos := 0;
    for q in select * from jsonb_array_elements(coalesce(r -> 'questions', '[]'::jsonb)) loop
      qpos := qpos + 1;
      insert into public.questions (round_id, position, text, topic)
      values (rid, qpos, btrim(q ->> 'text'), nullif(btrim(coalesce(q ->> 'topic', '')), ''));
    end loop;
  end loop;
end $$;

create function public._apply_experience_changes(p_id uuid, p_changes jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.experiences e set
    role = coalesce(nullif(btrim(p_changes ->> 'role'), ''), e.role),
    drive_type = coalesce(p_changes ->> 'driveType', e.drive_type),
    interview_year = coalesce((p_changes ->> 'interviewYear')::int, e.interview_year),
    interview_month = case when p_changes ? 'interviewMonth' then nullif(p_changes ->> 'interviewMonth', '')::int else e.interview_month end,
    outcome = coalesce(p_changes ->> 'outcome', e.outcome)
  where e.id = p_id;
  if p_changes ? 'rounds' then perform public._replace_rounds(p_id, p_changes -> 'rounds'); end if;
  perform public.refresh_experience_search(p_id);
end $$;

-- ---------------------------------------------------------------- author: edit / result update (FR-24, FR-25)
-- A live post is never changed in place: the proposal waits beside it and readers keep seeing the approved version.
-- A post that is not public yet is edited directly. Anonymity changes apply at once (a privacy right, like withdrawing).
create function public.update_experience(p_id uuid, p_payload jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); e public.experiences; changes jsonb; anon_only boolean := false;
begin
  if uid is null then raise exception 'UNAUTHENTICATED: Sign in required.' using errcode = 'P0001'; end if;
  select * into e from public.experiences where id = p_id and author_id = uid for update;
  if not found then raise exception 'NOT_FOUND: Experience not found.' using errcode = 'P0001'; end if;
  if e.status = 'removed' then raise exception 'FORBIDDEN: A removed experience cannot be edited.' using errcode = 'P0001'; end if;

  select jsonb_object_agg(k, v) into changes from jsonb_each(p_payload) t(k, v)
   where k in ('role', 'driveType', 'interviewYear', 'interviewMonth', 'outcome', 'rounds');

  if p_payload ? 'isAnonymous' then
    update public.experiences set is_anonymous = (p_payload ->> 'isAnonymous')::boolean where id = p_id;
    anon_only := changes is null;
  end if;
  if changes is null then
    if anon_only then return 'applied'; end if;
    raise exception 'VALIDATION: Nothing to change.' using errcode = 'P0001';
  end if;

  if e.status = 'published' then
    update public.experiences set pending_update = jsonb_build_object('changes', changes, 'submitted_at', now()), update_review_note = null where id = p_id;
    return 'queued';
  end if;
  perform public._apply_experience_changes(p_id, changes);
  if e.status = 'rejected' then update public.experiences set status = 'pending', review_note = null where id = p_id; end if;
  return 'applied';
end $$;

create function public.cancel_experience_update(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'UNAUTHENTICATED: Sign in required.' using errcode = 'P0001'; end if;
  update public.experiences set pending_update = null where id = p_id and author_id = uid and pending_update is not null;
  if not found then raise exception 'NOT_FOUND: There is no pending update to cancel.' using errcode = 'P0001'; end if;
end $$;

-- ---------------------------------------------------------------- admin: review queue for updates
create function public.admin_list_updates() returns table (
  id uuid, company_name text, company_slug text, role text, outcome text, interview_year int,
  changes jsonb, submitted_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED: Sign in required.' using errcode = 'P0001'; end if;
  if not public.is_admin() then raise exception 'FORBIDDEN: Admins only.' using errcode = 'P0001'; end if;
  return query
    select e.id, e.company_name, e.company_slug, e.role, e.outcome, e.interview_year,
           e.pending_update -> 'changes', (e.pending_update ->> 'submitted_at')::timestamptz
    from public.experiences e where e.pending_update is not null order by (e.pending_update ->> 'submitted_at')::timestamptz;
end $$;

create function public.admin_decide_update(p_id uuid, p_approve boolean, p_note text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); e public.experiences;
begin
  if uid is null then raise exception 'UNAUTHENTICATED: Sign in required.' using errcode = 'P0001'; end if;
  if not public.is_admin() then raise exception 'FORBIDDEN: Admins only.' using errcode = 'P0001'; end if;
  select * into e from public.experiences where id = p_id for update;
  if not found then raise exception 'NOT_FOUND: Experience not found.' using errcode = 'P0001'; end if;
  if e.pending_update is null then raise exception 'CONFLICT: There is no pending update on this experience.' using errcode = 'P0001'; end if;
  if p_approve then
    perform public._apply_experience_changes(p_id, e.pending_update -> 'changes');
    update public.experiences set pending_update = null, update_review_note = null, reviewed_by = uid, reviewed_at = now() where id = p_id;
    insert into public.moderation_logs (action, experience_id, admin_id, company_name, role) values ('approve-update', p_id, uid, e.company_name, e.role);
    return 'applied';
  end if;
  if coalesce(btrim(p_note), '') = '' then raise exception 'VALIDATION: A note is required when rejecting an update.' using errcode = 'P0001'; end if;
  update public.experiences set pending_update = null, update_review_note = left(btrim(p_note), 1000) where id = p_id;
  insert into public.moderation_logs (action, experience_id, admin_id, company_name, role) values ('reject-update', p_id, uid, e.company_name, e.role);
  return 'rejected';
end $$;

-- the owner and admins also see the waiting change on the post itself
create or replace function public.get_experience(p_id uuid) returns jsonb
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
    res := res || jsonb_build_object('status', e.status, 'review_note', e.review_note, 'is_owner', e.author_id = viewer,
                                     'is_anonymous', e.is_anonymous, 'pending_update', e.pending_update -> 'changes', 'update_review_note', e.update_review_note);
  end if;
  return res;
end $$;

-- ---------------------------------------------------------------- account deletion (FR-12). Service role only: it runs just before the auth user is deleted.
-- keep: live posts are detached and forced anonymous; posts that are not live are deleted. delete: everything is deleted.
create function public.prepare_account_deletion(p_user uuid, p_keep_live boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare kept int := 0; removed int := 0;
begin
  if exists (select 1 from public.profiles where id = p_user and role = 'admin') then
    raise exception 'FORBIDDEN: Admin accounts cannot delete themselves.' using errcode = 'P0001';
  end if;
  if p_keep_live then
    update public.experiences set author_id = null, author_name = null, author_branch = null, is_anonymous = true
     where author_id = p_user and status = 'published';
    get diagnostics kept = row_count;
    delete from public.experiences where author_id = p_user and status <> 'published';
    get diagnostics removed = row_count;
  else
    delete from public.experiences where author_id = p_user;
    get diagnostics removed = row_count;
  end if;
  return jsonb_build_object('kept', kept, 'deleted', removed);
end $$;

-- ---------------------------------------------------------------- admin: post on behalf of a student (FR-45). Needs the student's consent.
create function public.admin_post_experience(p_payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cname text; cslug text; cid uuid; cdisplay text; eid uuid;
begin
  if uid is null then raise exception 'UNAUTHENTICATED: Sign in required.' using errcode = 'P0001'; end if;
  if not public.is_admin() then raise exception 'FORBIDDEN: Admins only.' using errcode = 'P0001'; end if;
  if coalesce(p_payload ->> 'studentConsented', '') <> 'true' then
    raise exception 'VALIDATION: The student must have agreed to public posting.' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_payload ->> 'authorName'), '') = '' then raise exception 'VALIDATION: The student''s name is required.' using errcode = 'P0001'; end if;
  cname := btrim(coalesce(p_payload ->> 'company', ''));
  cslug := public.slugify(cname);
  if cslug = '' then raise exception 'VALIDATION: Company is required.' using errcode = 'P0001'; end if;

  select c.id, c.name into cid, cdisplay from public.companies c
   where c.slug = cslug or lower(cname) = any (select lower(a) from unnest(c.aliases) a) limit 1;
  if cid is null then   -- an admin-created company needs no second approval
    insert into public.companies (name, slug, name_lower, status) values (left(cname, 120), cslug, lower(left(cname, 120)), 'active')
    on conflict (slug) do nothing returning id, name into cid, cdisplay;
    if cid is null then select c.id, c.name into cid, cdisplay from public.companies c where c.slug = cslug; end if;
  end if;

  insert into public.experiences (company_id, company_slug, company_name, author_id, author_name, author_batch, author_branch, is_anonymous,
      role, drive_type, interview_year, interview_month, outcome, campus, status, source, consented_at, reviewed_by, reviewed_at)
  values (cid, (select slug from public.companies where id = cid), cdisplay, null, btrim(p_payload ->> 'authorName'),
      (p_payload ->> 'authorBatch')::int, p_payload ->> 'authorBranch', coalesce((p_payload ->> 'isAnonymous')::boolean, false),
      btrim(p_payload ->> 'role'), p_payload ->> 'driveType', (p_payload ->> 'interviewYear')::int,
      nullif(p_payload ->> 'interviewMonth', '')::int, p_payload ->> 'outcome', coalesce(p_payload ->> 'campus', 'ru'),
      'published', 'admin', now(), uid, now())
  returning id into eid;
  perform public._replace_rounds(eid, p_payload -> 'rounds');
  perform public.refresh_experience_search(eid);
  insert into public.moderation_logs (action, experience_id, admin_id, company_name, role) values ('post-on-behalf', eid, uid, cdisplay, btrim(p_payload ->> 'role'));
  return eid;
end $$;

-- ---------------------------------------------------------------- admin: reports queue (FR-43)
create function public.admin_list_reports(p_status text default 'open') returns table (
  id uuid, experience_id uuid, company_name text, role text, experience_status text, reason text, note text,
  status text, created_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED: Sign in required.' using errcode = 'P0001'; end if;
  if not public.is_admin() then raise exception 'FORBIDDEN: Admins only.' using errcode = 'P0001'; end if;
  if p_status not in ('open', 'actioned', 'dismissed') then raise exception 'VALIDATION: Unknown status.' using errcode = 'P0001'; end if;
  return query
    select r.id, r.experience_id, e.company_name, e.role, e.status, r.reason, r.note, r.status, r.created_at
    from public.reports r join public.experiences e on e.id = r.experience_id
    where r.status = p_status order by r.created_at limit 100;
end $$;

create function public.admin_dismiss_report(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); rep public.reports; e public.experiences;
begin
  if uid is null then raise exception 'UNAUTHENTICATED: Sign in required.' using errcode = 'P0001'; end if;
  if not public.is_admin() then raise exception 'FORBIDDEN: Admins only.' using errcode = 'P0001'; end if;
  update public.reports set status = 'dismissed', resolved_by = uid, resolved_at = now()
   where id = p_id and status = 'open' returning * into rep;
  if not found then
    if exists (select 1 from public.reports where id = p_id) then raise exception 'CONFLICT: This report is already settled.' using errcode = 'P0001';
    else raise exception 'NOT_FOUND: Report not found.' using errcode = 'P0001'; end if;
  end if;
  select * into e from public.experiences where id = rep.experience_id;
  insert into public.moderation_logs (action, experience_id, admin_id, report_id, company_name, role) values ('dismiss-report', rep.experience_id, uid, rep.id, e.company_name, e.role);
  return 'dismissed';
end $$;

-- ---------------------------------------------------------------- grants
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.list_experiences(text, text, text, int, text, text, timestamptz, uuid, int) to anon, authenticated;
grant execute on function public.get_experience(uuid) to anon, authenticated;
grant execute on function public.get_stats() to anon, authenticated;
grant execute on function public.list_company_sources(text, int) to anon, authenticated;
grant execute on function public.list_my_experiences() to authenticated;
grant execute on function public.submit_experience(jsonb) to authenticated;
grant execute on function public.set_experience_visibility(uuid, boolean) to authenticated;
grant execute on function public.moderate_experience(uuid, text, text) to authenticated;
grant execute on function public.vote_experience(uuid, boolean) to authenticated;
grant execute on function public.bookmark_experience(uuid, boolean) to authenticated;
grant execute on function public.my_interactions(uuid[]) to authenticated;
grant execute on function public.report_experience(uuid, text, text) to authenticated;
grant execute on function public.admin_list_experiences(text, timestamptz, uuid, int) to authenticated;
grant execute on function public.list_my_bookmarks(timestamptz, uuid, int) to authenticated;
grant execute on function public.admin_list_pending_companies() to authenticated;
grant execute on function public.admin_decide_company(text, text, text) to authenticated;
grant execute on function public.update_experience(uuid, jsonb) to authenticated;
grant execute on function public.cancel_experience_update(uuid) to authenticated;
grant execute on function public.admin_list_updates() to authenticated;
grant execute on function public.admin_decide_update(uuid, boolean, text) to authenticated;
grant execute on function public.admin_post_experience(jsonb) to authenticated;
grant execute on function public.admin_list_reports(text) to authenticated;
grant execute on function public.admin_dismiss_report(uuid) to authenticated;
grant execute on function public.check_rate_limit(text, text, int, int) to service_role;
grant execute on function public.prepare_account_deletion(uuid, boolean) to service_role;
