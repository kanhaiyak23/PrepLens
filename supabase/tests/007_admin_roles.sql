-- Admin roles (ADR-31): only admins change roles, no self-removal, never zero admins, every change logged, log stays append-only.
do $$
declare boss uuid := gen_random_uuid(); stu uuid := gen_random_uuid(); other uuid := gen_random_uuid();
        log text := ''; n int; r text; j jsonb;
begin
  insert into public.admin_emails values ('boss7@nst.rishihood.edu.in') on conflict do nothing;
  insert into auth.users (id, email, raw_user_meta_data) values (boss, 'boss7@nst.rishihood.edu.in', '{"name":"Boss"}');
  insert into auth.users (id, email, raw_user_meta_data) values (stu, 'stu7@nst.rishihood.edu.in', '{"name":"Stu"}');
  insert into auth.users (id, email, raw_user_meta_data) values (other, 'other7@nst.rishihood.edu.in', '{"name":"Other"}');

  -- a student cannot list, grant or revoke
  perform set_config('request.jwt.claims', json_build_object('sub', stu, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.admin_list_admins(); log := log || 'FAIL student listed; '; exception when others then log := log || 'ok student list blocked -> ' || split_part(sqlerrm, ':', 1) || '; '; end;
  begin perform public.admin_grant_admin('stu7@nst.rishihood.edu.in'); log := log || 'FAIL student granted; '; exception when others then log := log || 'ok student grant blocked -> ' || split_part(sqlerrm, ':', 1) || '; '; end;
  begin perform public._change_role(stu, 'admin'); log := log || 'FAIL internal function callable; '; exception when others then log := log || 'ok internal not callable; '; end;
  reset role;

  -- the admin promotes the student (case and spaces in the email do not matter)
  perform set_config('request.jwt.claims', json_build_object('sub', boss, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.admin_grant_admin('  STU7@nst.rishihood.edu.in ');
  log := log || 'granted_role=' || (j ->> 'role') || '; ';
  begin perform public.admin_grant_admin('stu7@nst.rishihood.edu.in'); log := log || 'FAIL double grant; '; exception when others then log := log || 'ok double grant -> ' || split_part(sqlerrm, ':', 1) || '; '; end;
  begin perform public.admin_grant_admin('nobody7@nst.rishihood.edu.in'); log := log || 'FAIL unknown email; '; exception when others then log := log || 'ok unknown email -> ' || split_part(sqlerrm, ':', 1) || '; '; end;
  select count(*) into n from public.admin_list_admins() a where a.email like '%7@nst.rishihood.edu.in'; log := log || 'admins_listed=' || n || '; ';

  -- nobody removes themselves
  begin perform public.admin_revoke_admin(boss); log := log || 'FAIL self revoke; '; exception when others then log := log || 'ok self revoke -> ' || split_part(sqlerrm, ':', 1) || '; '; end;
  reset role;

  -- the new admin removes the founding admin; the founder leaves the sign-up allowlist and loses admin power at once
  perform set_config('request.jwt.claims', json_build_object('sub', stu, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.admin_revoke_admin(boss);
  log := log || 'revoked_role=' || (j ->> 'role') || '; ';
  reset role;
  select count(*) into n from public.admin_emails where email = 'boss7@nst.rishihood.edu.in'; log := log || 'boss_in_allowlist=' || n || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', boss, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.admin_grant_admin('other7@nst.rishihood.edu.in'); log := log || 'FAIL demoted admin still acts; '; exception when others then log := log || 'ok demoted admin blocked -> ' || split_part(sqlerrm, ':', 1) || '; '; end;
  reset role;

  -- both changes are logged with their subject, and the log cannot be edited
  select string_agg(action || ':' || subject_email, ', ' order by created_at, action) into r from public.moderation_logs where subject_email like '%7@nst.rishihood.edu.in';
  log := log || 'log=[' || r || ']; ';
  begin update public.moderation_logs set subject_email = 'x' where subject_email = 'stu7@nst.rishihood.edu.in'; log := log || 'FAIL log edited; ';
  exception when others then log := log || 'ok log append-only; '; end;

  raise exception 'RESULT: %', log;
end $$;
-- Expected: every "ok"; granted_role=admin; admins_listed=2; revoked_role=student; boss_in_allowlist=0;
-- log=[grant-admin:stu7@..., revoke-admin:boss7@...]. The concurrency claim (two admins demoting each other at once
-- leaves one admin) needs two sessions, see docs/design/09-errors-and-concurrency.md.
