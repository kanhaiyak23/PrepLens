-- 0005: admin moderation queue and the caller's bookmarks. Same conventions as 0003 (security definer, P0001 "CODE: text").

create function public.admin_list_experiences(
  p_status text default 'pending', p_cursor_created timestamptz default null, p_cursor_id uuid default null, p_limit int default 20
) returns table (
  id uuid, company_name text, company_slug text, role text, drive_type text, interview_year int,
  interview_month int, outcome text, campus text, round_count int, upvote_count int,
  created_at timestamptz, updated_at timestamptz, author jsonb, status text, review_note text, open_reports int
) language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED: Sign in required.' using errcode = 'P0001'; end if;
  if not public.is_admin() then raise exception 'FORBIDDEN: Admins only.' using errcode = 'P0001'; end if;
  if p_status not in ('pending','published','rejected','unpublished','removed') then
    raise exception 'VALIDATION: Unknown status.' using errcode = 'P0001';
  end if;
  return query
    select e.id, e.company_name, e.company_slug, e.role, e.drive_type, e.interview_year, e.interview_month,
           e.outcome, e.campus,
           (select count(*)::int from public.interview_rounds r where r.experience_id = e.id),
           e.upvote_count, e.created_at, e.updated_at,
           public._author_json(e.is_anonymous, e.author_id, e.author_name, e.author_batch, e.author_branch, e.consented_at),
           e.status, e.review_note,
           (select count(*)::int from public.reports rp where rp.experience_id = e.id and rp.status = 'open')
    from public.experiences e
    where e.status = p_status
      and (p_cursor_created is null or (e.created_at, e.id) < (p_cursor_created, p_cursor_id))
    order by e.created_at desc, e.id desc
    limit least(greatest(coalesce(p_limit, 20), 1), 51);
end $$;

create function public.list_my_bookmarks(
  p_cursor_at timestamptz default null, p_cursor_id uuid default null, p_limit int default 20
) returns table (
  id uuid, company_name text, company_slug text, role text, drive_type text, interview_year int,
  interview_month int, outcome text, campus text, round_count int, upvote_count int,
  created_at timestamptz, updated_at timestamptz, author jsonb, bookmarked_at timestamptz
) language sql stable security definer set search_path = '' as $$
  select e.id, e.company_name, e.company_slug, e.role, e.drive_type, e.interview_year, e.interview_month,
         e.outcome, e.campus,
         (select count(*)::int from public.interview_rounds r where r.experience_id = e.id),
         e.upvote_count, e.created_at, e.updated_at,
         public._author_json(e.is_anonymous, e.author_id, e.author_name, e.author_batch, e.author_branch, e.consented_at),
         b.created_at
  from public.bookmarks b
  join public.experiences e on e.id = b.experience_id
  where b.user_id = auth.uid() and e.status = 'published'
    and (p_cursor_at is null or (b.created_at, e.id) < (p_cursor_at, p_cursor_id))
  order by b.created_at desc, e.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 51)
$$;

revoke execute on function public.admin_list_experiences(text, timestamptz, uuid, int) from public, anon, authenticated;
revoke execute on function public.list_my_bookmarks(timestamptz, uuid, int) from public, anon, authenticated;
grant execute on function public.admin_list_experiences(text, timestamptz, uuid, int) to authenticated;
grant execute on function public.list_my_bookmarks(timestamptz, uuid, int) to authenticated;
