-- 0008: company approval and merge (spec: a student-suggested company starts pending; an admin approves it or merges it into an existing one).
-- Every decision is written to the append-only moderation log (ADR-10), with experience_id left null.
alter table public.moderation_logs drop constraint moderation_logs_action_check;
alter table public.moderation_logs add constraint moderation_logs_action_check check (action in
  ('approve','reject','approve-update','reject-update','post-on-behalf','remove','reinstate','dismiss-report','approve-company','merge-company'));

create function public.admin_list_pending_companies() returns table (name text, slug text, created_at timestamptz, post_count int)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED: Sign in required.' using errcode = 'P0001'; end if;
  if not public.is_admin() then raise exception 'FORBIDDEN: Admins only.' using errcode = 'P0001'; end if;
  return query
    select c.name, c.slug, c.created_at, (select count(*)::int from public.experiences e where e.company_id = c.id)
    from public.companies c where c.status = 'pending' order by c.created_at;
end $$;

create function public.admin_decide_company(p_slug text, p_action text, p_merge_into text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); src public.companies; dst public.companies;
begin
  if uid is null then raise exception 'UNAUTHENTICATED: Sign in required.' using errcode = 'P0001'; end if;
  if not public.is_admin() then raise exception 'FORBIDDEN: Admins only.' using errcode = 'P0001'; end if;
  select * into src from public.companies where slug = p_slug for update;
  if not found then raise exception 'NOT_FOUND: Company not found.' using errcode = 'P0001'; end if;
  if src.status <> 'pending' then raise exception 'CONFLICT: This company is no longer pending.' using errcode = 'P0001'; end if;

  if p_action = 'approve' then
    update public.companies set status = 'active' where id = src.id;
    insert into public.moderation_logs (action, admin_id, company_name) values ('approve-company', uid, src.name);
    return 'active';
  elsif p_action = 'merge' then
    if p_merge_into is null or p_merge_into = p_slug then
      raise exception 'VALIDATION: Choose a different, existing company to merge into.' using errcode = 'P0001';
    end if;
    select * into dst from public.companies where slug = p_merge_into and status = 'active' for update;
    if not found then raise exception 'NOT_FOUND: The company to merge into was not found.' using errcode = 'P0001'; end if;
    update public.experiences set company_id = dst.id, company_slug = dst.slug, company_name = dst.name where company_id = src.id;
    update public.companies set
        aliases = (select coalesce(array_agg(distinct a), '{}') from unnest(dst.aliases || array[src.name]) a),
        experience_count = (select count(*)::int from public.experiences e where e.company_id = dst.id and e.status = 'published')
      where id = dst.id;
    perform public.refresh_experience_search(e.id) from public.experiences e where e.company_id = dst.id;
    delete from public.companies where id = src.id;
    insert into public.moderation_logs (action, admin_id, company_name) values ('merge-company', uid, src.name || ' -> ' || dst.name);
    return 'merged';
  end if;
  raise exception 'VALIDATION: Unknown company action.' using errcode = 'P0001';
end $$;

revoke execute on function public.admin_list_pending_companies() from public, anon, authenticated;
revoke execute on function public.admin_decide_company(text, text, text) from public, anon, authenticated;
grant execute on function public.admin_list_pending_companies() to authenticated;
grant execute on function public.admin_decide_company(text, text, text) to authenticated;
