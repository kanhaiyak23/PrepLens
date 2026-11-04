do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); adm uuid := gen_random_uuid();
  e1 uuid; e2 uuid; e3 uuid; ob uuid; rid uuid; r jsonb; n int; log text := ''; res text; k jsonb;
  payload text := '{"company":"Upd Co","role":"SDE","driveType":"on-campus","interviewYear":2026,"outcome":"in-process","isAnonymous":false,"consent":true,"rounds":[{"name":"OA","questions":[{"text":"Two sum","topic":"Arrays"}]}]}';
begin
  insert into public.admin_emails values ('boss4@nst.rishihood.edu.in') on conflict do nothing;
  insert into auth.users (id, email, raw_user_meta_data) values (a, 'asha4@nst.rishihood.edu.in', '{"name":"Asha Four"}');
  insert into auth.users (id, email, raw_user_meta_data) values (b, 'bob4@nst.rishihood.edu.in', '{"name":"Bob Four"}');
  insert into auth.users (id, email, raw_user_meta_data) values (adm, 'boss4@nst.rishihood.edu.in', '{"name":"Boss Four"}');
  update public.profiles set graduation_batch = 2027, branch = 'CSE' where id in (a, b);

  -- A posts; admin approves
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  e1 := public.submit_experience(payload::jsonb);
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform public.moderate_experience(e1, 'approve');

  -- 1. editing a LIVE post queues it; readers keep the approved version
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  res := public.update_experience(e1, '{"outcome":"selected","rounds":[{"name":"Technical","questions":[{"text":"Reverse a list","topic":"Linked lists"}]}]}'::jsonb);
  log := log || 'live_edit=' || res || '; ';
  perform set_config('request.jwt.claims', '', true);
  r := public.get_experience(e1);
  log := log || 'public_outcome=' || (r ->> 'outcome') || ' public_round=' || (r -> 'rounds' -> 0 ->> 'name') || ' public_sees_pending=' || (r ? 'pending_update') || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  log := log || 'owner_sees_pending=' || ((public.get_experience(e1)) ? 'pending_update') || '; ';
  begin perform public.update_experience(e1, '{"outcome":"selected"}'::jsonb); exception when others then null; end;

  -- 2. another student cannot edit it
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin perform public.update_experience(e1, '{"outcome":"rejected"}'::jsonb); log := log || 'FAIL other edited; ';
  exception when others then log := log || 'ok other blocked -> ' || split_part(sqlerrm, ':', 1) || '; '; end;
  begin perform public.admin_decide_update(e1, true); log := log || 'FAIL student approved update; ';
  exception when others then log := log || 'ok student cannot approve -> ' || split_part(sqlerrm, ':', 1) || '; '; end;

  -- 3. admin approves: content swaps in, pending clears, decision logged
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  select count(*) into n from public.admin_list_updates(); log := log || 'queue=' || n || '; ';
  log := log || 'approve_update=' || public.admin_decide_update(e1, true) || '; ';
  perform set_config('request.jwt.claims', '', true);
  r := public.get_experience(e1);
  log := log || 'after_outcome=' || (r ->> 'outcome') || ' after_round=' || (r -> 'rounds' -> 0 ->> 'name') || ' search_hits=' || (select count(*) from public.list_experiences(p_q => 'reverse')) || '; ';
  begin perform public.admin_decide_update(e1, true); log := log || 'FAIL double decide; '; exception when others then log := log || 'ok double -> ' || split_part(sqlerrm, ':', 1) || '; '; end;

  -- 4. reject needs a note and keeps the live content
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.update_experience(e1, '{"outcome":"withdrew"}'::jsonb);
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  begin perform public.admin_decide_update(e1, false); log := log || 'FAIL reject without note; '; exception when others then log := log || 'ok reject needs note -> ' || split_part(sqlerrm, ':', 1) || '; '; end;
  log := log || 'reject=' || public.admin_decide_update(e1, false, 'Not accurate.') || '; ';
  select outcome into res from public.experiences where id = e1; log := log || 'outcome_after_reject=' || res || '; ';

  -- 5. anonymity applies at once, even on a live post; an update can be cancelled
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  log := log || 'anon_toggle=' || public.update_experience(e1, '{"isAnonymous":true}'::jsonb) || '; ';
  perform set_config('request.jwt.claims', '', true);
  log := log || 'public_author=' || (public.get_experience(e1) -> 'author')::text || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.update_experience(e1, '{"role":"Backend SDE"}'::jsonb);
  perform public.cancel_experience_update(e1);
  begin perform public.cancel_experience_update(e1); log := log || 'FAIL cancel twice; '; exception when others then log := log || 'ok cancel twice -> ' || split_part(sqlerrm, ':', 1) || '; '; end;

  -- 6. a post that is not public is edited directly; a rejected one goes back to review
  e2 := public.submit_experience(payload::jsonb);
  log := log || 'pending_edit=' || public.update_experience(e2, '{"role":"Data Analyst"}'::jsonb) || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform public.moderate_experience(e2, 'reject', 'Add detail.');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.update_experience(e2, '{"role":"Data Analyst II"}'::jsonb);
  select status, role into r from (select status, role from public.experiences where id = e2) t; log := log || 'rejected_then_edit_status=' || (select status from public.experiences where id = e2) || '; ';

  -- 7. post on behalf of a student: admin only, consent required, published at once, named unless anonymous, logged
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin perform public.admin_post_experience('{}'::jsonb); log := log || 'FAIL student posted on behalf; '; exception when others then log := log || 'ok student blocked -> ' || split_part(sqlerrm, ':', 1) || '; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  begin perform public.admin_post_experience(('{"studentConsented":false,"authorName":"Maya","authorBatch":2026,"authorBranch":"ECE",' || substr(payload, 2))::jsonb); log := log || 'FAIL no consent; ';
  exception when others then log := log || 'ok no consent -> ' || split_part(sqlerrm, ':', 1) || '; '; end;
  ob := public.admin_post_experience(('{"studentConsented":true,"authorName":"Maya Rao","authorBatch":2026,"authorBranch":"ECE","campus":"bangalore",' || substr(payload, 2))::jsonb);
  perform set_config('request.jwt.claims', '', true);
  select to_jsonb(l) into k from public.list_experiences(p_campus => 'bangalore') l limit 1;
  log := log || 'onbehalf_public=' || (k -> 'author')::text || ' campus=' || (k ->> 'campus') || '; ';

  -- 8. reports queue: list, dismiss, double dismiss, student blocked
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  rid := public.report_experience(e1, 'abusive', 'rude');
  begin perform public.admin_list_reports(); log := log || 'FAIL student listed reports; '; exception when others then log := log || 'ok student blocked -> ' || split_part(sqlerrm, ':', 1) || '; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  select count(*) into n from public.admin_list_reports('open'); log := log || 'open_reports=' || n || '; ';
  log := log || 'dismiss=' || public.admin_dismiss_report(rid) || '; ';
  begin perform public.admin_dismiss_report(rid); log := log || 'FAIL double dismiss; '; exception when others then log := log || 'ok double -> ' || split_part(sqlerrm, ':', 1) || '; '; end;
  select count(*) into n from public.moderation_logs where action = 'dismiss-report' and report_id = rid; log := log || 'dismiss_logged=' || n || '; ';

  -- 9. account deletion (service role path): keep detaches live posts and deletes the rest; admins cannot self-delete; users cannot call it
  perform set_config('request.jwt.claims', '', true);
  e3 := (select id from public.experiences where author_id = a and status = 'pending' limit 1);
  log := log || 'keep=' || public.prepare_account_deletion(a, true)::text || '; ';
  select count(*) into n from public.experiences where id = e1 and author_id is null and is_anonymous and author_branch is null; log := log || 'live_post_detached=' || n || '; ';
  select count(*) into n from public.experiences where id = e2; log := log || 'rejected_post_deleted=' || (1 - n) || '; ';
  begin perform public.prepare_account_deletion(adm, false); log := log || 'FAIL admin self-delete; '; exception when others then log := log || 'ok admin blocked -> ' || split_part(sqlerrm, ':', 1) || '; '; end;
  delete from auth.users where id = a;
  select count(*) into n from public.profiles where id = a; log := log || 'profile_gone=' || (1 - n) || '; ';
  select count(*) into n from public.experiences where id = e1; log := log || 'live_post_survives_user=' || n || '; ';
  set local role authenticated;
  begin perform public.prepare_account_deletion(b, false); log := log || 'FAIL user ran deletion fn; '; exception when insufficient_privilege then log := log || 'ok user cannot run deletion fn; '; end;
  reset role;

  raise exception 'RESULT: %', log;
end $$;
