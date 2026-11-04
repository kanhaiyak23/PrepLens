do $$
declare plan text := ''; r record; p text; owner_id uuid;
begin
  -- Needs at least one profile. Builds 20,000 synthetic published rows across 40 companies, reports the real plans, rolls back.
  select id into owner_id from public.profiles limit 1;
  if owner_id is null then raise exception 'RESULT: needs one profile (sign in once first)'; end if;
  for i in 1..40 loop insert into public.companies (name, slug, name_lower, status) values ('Co ' || i, 'co-' || i, lower('Co ' || i), 'active'); end loop;
  insert into public.experiences (company_id, company_slug, company_name, author_id, author_batch, author_branch, is_anonymous, role, drive_type, interview_year, outcome, campus, status, consented_at, created_at)
  select c.id, c.slug, c.name, owner_id, 2027, 'CSE', (g % 3 = 0), 'SDE', 'on-campus', 2025 + (g % 2), 'selected', 'ru', 'published', now(), now() - (g || ' minutes')::interval
  from generate_series(1, 20000) g join public.companies c on c.slug = 'co-' || (1 + g % 40);
  analyze public.experiences;
  for p in select unnest(array[
      'select id from public.experiences where status = ''published'' order by created_at desc, id desc limit 21',
      'select id from public.experiences where status = ''published'' and company_slug = ''co-7'' order by created_at desc, id desc limit 21',
      'select id from public.experiences where status = ''published'' and (created_at, id) < (now() - interval ''5000 minutes'', ''ffffffff-ffff-ffff-ffff-ffffffffffff'') order by created_at desc, id desc limit 21'])
  loop
    plan := plan || E'\n--- ' || left(p, 110) || E'\n';
    for r in execute 'explain (analyze, costs off, timing off, summary off) ' || p loop plan := plan || r."QUERY PLAN" || E'\n'; end loop;
  end loop;
  raise exception 'PLANS (expect Index Only Scan and actual rows=21 each): %', plan;
end $$;
