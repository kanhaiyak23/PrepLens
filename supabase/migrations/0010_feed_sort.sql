-- 0010: sort the archive by when the interview happened (the FeedSort strategy's second implementation).
-- Keyset on (interview_year, coalesce(interview_month, 0), id), all descending, so a post with no month sorts after the dated posts of its year.
drop function public.list_experiences(text, text, text, int, text, text, timestamptz, uuid, int);
drop index if exists public.exp_interview_feed;
create index exp_interview_sort on public.experiences (status, interview_year desc, (coalesce(interview_month, 0)) desc, id desc);

create function public.list_experiences(
  p_company text default null, p_role text default null, p_outcome text default null,
  p_year int default null, p_campus text default null, p_q text default null,
  p_cursor_created timestamptz default null, p_cursor_id uuid default null, p_limit int default 20,
  p_sort text default 'newest', p_cursor_year int default null, p_cursor_month int default null
) returns table (
  id uuid, company_name text, company_slug text, role text, drive_type text, interview_year int,
  interview_month int, outcome text, campus text, round_count int, upvote_count int,
  created_at timestamptz, updated_at timestamptz, author jsonb
) language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if p_sort not in ('newest', 'interview') then
    raise exception 'VALIDATION: Unknown sort.' using errcode = 'P0001';
  end if;
  if p_sort = 'newest' then
    return query
      select e.id, e.company_name, e.company_slug, e.role, e.drive_type, e.interview_year, e.interview_month, e.outcome, e.campus,
             (select count(*)::int from public.interview_rounds r where r.experience_id = e.id),
             e.upvote_count, e.created_at, e.updated_at,
             public._author_json(e.is_anonymous, e.author_id, e.author_name, e.author_batch, e.author_branch, e.consented_at)
      from public.experiences e
      where e.status = 'published'
        and (p_company is null or e.company_slug = p_company) and (p_role is null or e.role = p_role)
        and (p_outcome is null or e.outcome = p_outcome) and (p_year is null or e.interview_year = p_year)
        and (p_campus is null or e.campus = p_campus)
        and (p_q is null or btrim(p_q) = '' or e.search_tsv @@ websearch_to_tsquery('english', p_q))
        and (p_cursor_created is null or (e.created_at, e.id) < (p_cursor_created, p_cursor_id))
      order by e.created_at desc, e.id desc
      limit least(greatest(coalesce(p_limit, 20), 1), 51);
  else
    return query
      select e.id, e.company_name, e.company_slug, e.role, e.drive_type, e.interview_year, e.interview_month, e.outcome, e.campus,
             (select count(*)::int from public.interview_rounds r where r.experience_id = e.id),
             e.upvote_count, e.created_at, e.updated_at,
             public._author_json(e.is_anonymous, e.author_id, e.author_name, e.author_batch, e.author_branch, e.consented_at)
      from public.experiences e
      where e.status = 'published'
        and (p_company is null or e.company_slug = p_company) and (p_role is null or e.role = p_role)
        and (p_outcome is null or e.outcome = p_outcome) and (p_year is null or e.interview_year = p_year)
        and (p_campus is null or e.campus = p_campus)
        and (p_q is null or btrim(p_q) = '' or e.search_tsv @@ websearch_to_tsquery('english', p_q))
        and (p_cursor_year is null or (e.interview_year, coalesce(e.interview_month, 0), e.id) < (p_cursor_year, coalesce(p_cursor_month, 0), p_cursor_id))
      order by e.interview_year desc, coalesce(e.interview_month, 0) desc, e.id desc
      limit least(greatest(coalesce(p_limit, 20), 1), 51);
  end if;
end $$;

revoke execute on function public.list_experiences(text, text, text, int, text, text, timestamptz, uuid, int, text, int, int) from public, anon, authenticated;
grant execute on function public.list_experiences(text, text, text, int, text, text, timestamptz, uuid, int, text, int, int) to anon, authenticated;
