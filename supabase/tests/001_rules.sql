do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); adm uuid := gen_random_uuid();
  eid uuid; r jsonb; n int; log text := '';
begin
  -- 1. college domain rule (ADR-05)
  begin insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'x@gmail.com', '{}'); log := log || 'FAIL gmail accepted; ';
  exception when others then log := log || 'ok gmail rejected; '; end;
  begin insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'a@nst.rishihood.edu.in.evil.com', '{}'); log := log || 'FAIL lookalike1 accepted; ';
  exception when others then log := log || 'ok lookalike1 rejected; '; end;
  begin insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'nst.rishihood.edu.in@gmail.com', '{}'); log := log || 'FAIL lookalike2 accepted; ';
  exception when others then log := log || 'ok lookalike2 rejected; '; end;

  -- 2. profiles and admin promotion
  insert into public.admin_emails values ('boss@nst.rishihood.edu.in') on conflict do nothing;
  insert into auth.users (id, email, raw_user_meta_data) values (a, 'Asha@NST.rishihood.edu.in', '{"full_name":"Asha Verma"}');
  insert into auth.users (id, email, raw_user_meta_data) values (b, 'bob@nst.rishihood.edu.in', '{"name":"Bob"}');
  insert into auth.users (id, email, raw_user_meta_data) values (adm, 'boss@nst.rishihood.edu.in', '{"name":"Boss"}');
  select count(*) into n from public.profiles where id in (a, b, adm); log := log || 'profiles=' || n || '; ';
  select count(*) into n from public.profiles where id = adm and role = 'admin'; log := log || 'admin=' || n || '; ';
  update public.profiles set graduation_batch = 2027, branch = 'CSE' where id = a;

  -- 3. submit as A (anonymous); company names resolve to one row (ADR-14)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  eid := public.submit_experience(jsonb_build_object('company','Example  Co','role','SDE','driveType','on-campus','interviewYear',2026,'interviewMonth',3,'outcome','selected','isAnonymous',true,'consent',true,
     'rounds', jsonb_build_array(jsonb_build_object('name','Technical','tips','say tests','questions', jsonb_build_array(jsonb_build_object('text','Reverse a linked list','topic','Linked lists'))))));
  perform public.submit_experience(jsonb_build_object('company','example co','role','SDE','driveType','on-campus','interviewYear',2026,'outcome','rejected','isAnonymous',false,'consent',true,'rounds', jsonb_build_array(jsonb_build_object('name','OA'))));
  select count(*) into n from public.companies where slug = 'example-co'; log := log || 'company_rows=' || n || '; ';
  begin perform public.submit_experience(jsonb_build_object('company','X','role','SDE','driveType','on-campus','interviewYear',2026,'outcome','selected','consent',false,'rounds','[{"name":"a"}]'::jsonb)); log := log || 'FAIL no-consent accepted; ';
  exception when others then log := log || 'ok no-consent rejected; '; end;
  begin perform public.submit_experience(jsonb_build_object('company','X','role','SDE','driveType','on-campus','interviewYear',2099,'outcome','selected','consent',true,'rounds','[{"name":"a"}]'::jsonb)); log := log || 'FAIL future accepted; ';
  exception when others then log := log || 'ok future rejected; '; end;

  -- 4. pending posts are invisible to the public
  perform set_config('request.jwt.claims', '', true);
  select count(*) into n from public.list_experiences(); log := log || 'anon_list_before=' || n || '; ';
  log := log || 'anon_get_pending=' || coalesce(public.get_experience(eid)::text, 'null') || '; ';

  -- 5. admin approves; a second decision conflicts; a student cannot moderate (ADR-10, compare-and-set)
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  log := log || 'approve=' || public.moderate_experience(eid, 'approve') || '; ';
  begin perform public.moderate_experience(eid, 'approve'); log := log || 'FAIL double approve; ';
  exception when others then log := log || 'ok double approve -> ' || split_part(sqlerrm, ':', 1) || '; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin perform public.moderate_experience(eid, 'remove'); log := log || 'FAIL student moderated; ';
  exception when others then log := log || 'ok student blocked -> ' || split_part(sqlerrm, ':', 1) || '; '; end;

  -- 6. anonymity in public payloads (ADR-06)
  perform set_config('request.jwt.claims', '', true);
  select to_jsonb(l) into r from public.list_experiences() l limit 1;
  log := log || 'anon_card_author=' || (r -> 'author')::text || '; ';
  r := public.get_experience(eid);
  log := log || 'detail_has_branch=' || ((r -> 'author') ? 'branch') || ' detail_has_name=' || ((r -> 'author') ? 'name') || ' has_author_id=' || (r ? 'author_id') || '; ';

  -- 7. votes are idempotent (ADR-07)
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.vote_experience(eid, true); perform public.vote_experience(eid, true);
  select upvote_count into n from public.experiences where id = eid; log := log || 'votes_after_double=' || n || '; ';
  perform public.vote_experience(eid, false);
  select upvote_count into n from public.experiences where id = eid; log := log || 'votes_after_unvote=' || n || '; ';

  -- 8. the moderation log is append only (ADR-10)
  begin update public.moderation_logs set company_name = 'x'; log := log || 'FAIL log updated; '; exception when others then log := log || 'ok log update blocked; '; end;
  begin delete from public.moderation_logs; log := log || 'FAIL log deleted; '; exception when others then log := log || 'ok log delete blocked; '; end;

  -- 9. rate limit (ADR-11)
  select count(*) filter (where public.check_rate_limit('u1','submit',5,86400)) into n from generate_series(1,7); log := log || 'rate_allowed_of_7=' || n || '; ';

  -- 10. direct table access is closed (ADR-04, ADR-25)
  set local role authenticated;
  begin perform 1 from public.experiences limit 1; log := log || 'FAIL direct select allowed; '; exception when insufficient_privilege then log := log || 'ok direct select denied; '; end;
  begin update public.profiles set role = 'admin' where id = b; log := log || 'FAIL role update allowed; '; exception when insufficient_privilege then log := log || 'ok role update denied; '; end;
  begin perform public.check_rate_limit('k','a',1,60); log := log || 'FAIL auth can rate-limit; '; exception when insufficient_privilege then log := log || 'ok auth cannot rate-limit; '; end;
  reset role;
  set local role anon;
  begin perform public.submit_experience('{}'::jsonb); log := log || 'FAIL anon submit; '; exception when insufficient_privilege then log := log || 'ok anon cannot submit; '; end;
  reset role;

  raise exception 'RESULT: %', log;
end $$;
