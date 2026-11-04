do $$
declare a uuid := gen_random_uuid(); cid uuid; ids uuid[]; log text := ''; r record; page1 uuid[]; page2 uuid[]; page3 uuid[]; last record;
begin
  insert into auth.users (id, email, raw_user_meta_data) values (a, 'sorter@nst.rishihood.edu.in', '{"name":"Sorter"}');
  insert into public.companies (name, slug, name_lower, status) values ('Sort Co', 'sort-co', 'sort co', 'active') returning id into cid;
  -- five published posts: 2026-03, 2026-03 (tie), 2026 (no month), 2025-11, 2025-01
  insert into public.experiences (company_id, company_slug, company_name, author_id, author_batch, role, drive_type, interview_year, interview_month, outcome, status, consented_at, created_at)
  select cid, 'sort-co', 'Sort Co', a, 2027, 'SDE', 'on-campus', v.y, v.m, 'selected', 'published', now(), now() - (v.n || ' minutes')::interval
  from (values (1, 2026, 3), (2, 2026, 3), (3, 2026, null::int), (4, 2025, 11), (5, 2025, 1)) v(n, y, m);
  -- walk the whole list two rows at a time, newest-interview first, using the keyset cursor
  page1 := array(select id from public.list_experiences(p_company => 'sort-co', p_sort => 'interview', p_limit => 2));
  select interview_year as y, coalesce(interview_month, 0) as m, id into last from public.experiences where id = page1[2];
  page2 := array(select id from public.list_experiences(p_company => 'sort-co', p_sort => 'interview', p_limit => 2, p_cursor_year => last.y, p_cursor_month => last.m, p_cursor_id => last.id));
  select interview_year as y, coalesce(interview_month, 0) as m, id into last from public.experiences where id = page2[2];
  page3 := array(select id from public.list_experiences(p_company => 'sort-co', p_sort => 'interview', p_limit => 2, p_cursor_year => last.y, p_cursor_month => last.m, p_cursor_id => last.id));
  log := log || 'pages=' || cardinality(page1) || '/' || cardinality(page2) || '/' || cardinality(page3) || '; ';
  log := log || 'no_repeat_no_skip=' || (select count(distinct x) from unnest(page1 || page2 || page3) x) || 'of5; ';
  log := log || 'order=' || (select string_agg(interview_year || '-' || coalesce(interview_month::text, 'x'), ',' order by ord) from unnest(page1 || page2 || page3) with ordinality t(x, ord) join public.experiences e on e.id = t.x) || '; ';
  begin perform * from public.list_experiences(p_sort => 'bogus'); log := log || 'FAIL bad sort accepted; '; exception when others then log := log || 'ok bad sort -> ' || split_part(sqlerrm, ':', 1) || '; '; end;
  log := log || 'newest_first_is_n1=' || (select (created_at = (select max(created_at) from public.experiences where company_slug = 'sort-co'))::text from public.list_experiences(p_company => 'sort-co', p_limit => 1)) || '; ';
  raise exception 'RESULT: % (expected order 2026-3,2026-3,2026-x,2025-11,2025-1)', log;
end $$;
