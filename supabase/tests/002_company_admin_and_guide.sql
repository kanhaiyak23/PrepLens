do $$
declare a uuid := gen_random_uuid(); adm uuid := gen_random_uuid(); e1 uuid; e2 uuid; log text := ''; n int; r record; j jsonb; lg text;
begin
  insert into public.admin_emails values ('boss3@nst.rishihood.edu.in') on conflict do nothing;
  insert into auth.users (id, email, raw_user_meta_data) values (a, 'asha3@nst.rishihood.edu.in', '{"name":"Asha"}');
  insert into auth.users (id, email, raw_user_meta_data) values (adm, 'boss3@nst.rishihood.edu.in', '{"name":"Boss"}');
  update public.profiles set graduation_batch = 2027, branch = 'CSE' where id = a;
  insert into public.companies (name, slug, name_lower, status) values ('Google', 'google', 'google', 'active');

  -- a typo'd company is created pending by a student
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  e1 := public.submit_experience('{"company":"Googel","role":"SDE","driveType":"on-campus","interviewYear":2026,"outcome":"selected","isAnonymous":true,"consent":true,"rounds":[{"name":"Tech","questions":[{"text":"Reverse a list","topic":"Linked lists"}]}]}'::jsonb);
  e2 := public.submit_experience('{"company":"Googel","role":"SDE","driveType":"on-campus","interviewYear":2026,"outcome":"rejected","isAnonymous":false,"consent":true,"rounds":[{"name":"OA"}]}'::jsonb);
  log := log || 'pending_company_hidden_from_guide=' || coalesce(public.list_company_sources('googel')::text, 'null') || '; ';
  begin perform public.admin_decide_company('googel', 'approve'); log := log || 'FAIL student decided; '; exception when others then log := log || 'ok student blocked -> ' || split_part(sqlerrm, ':', 1) || '; '; end;

  -- admin merges it into Google; posts move, counts and aliases follow, the decision is logged
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  select count(*) into n from public.admin_list_pending_companies(); log := log || 'pending_list=' || n || '; ';
  perform public.moderate_experience(e1, 'approve');
  log := log || 'merge=' || public.admin_decide_company('googel', 'merge', 'google') || '; ';
  select e.company_slug as s into r from public.experiences e where e.id = e1; log := log || 'moved_to=' || r.s || '; ';
  select c.experience_count as cnt, c.aliases::text as al into r from public.companies c where c.slug = 'google'; log := log || 'google_count=' || r.cnt || ' aliases=' || r.al || '; ';
  select count(*) into n from public.companies where slug = 'googel'; log := log || 'typo_company_left=' || n || '; ';
  select string_agg(action || ':' || company_name, ', ') into lg from public.moderation_logs where action like '%company'; log := log || 'log=[' || lg || ']; ';

  -- guide sources: published only, authors anonymised, withdrawn posts leave the sources
  perform set_config('request.jwt.claims', '', true);
  j := public.list_company_sources('google');
  log := log || 'guide_sources=' || jsonb_array_length(j -> 'experiences') || ' author=' || (j -> 'experiences' -> 0 -> 'author')::text || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform public.moderate_experience(e1, 'remove');
  perform set_config('request.jwt.claims', '', true);
  log := log || 'after_remove=' || jsonb_array_length(public.list_company_sources('google') -> 'experiences') || '; ';
  raise exception 'RESULT: %', log;
end $$;
