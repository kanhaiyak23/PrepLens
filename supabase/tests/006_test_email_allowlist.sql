-- Allowed test address signs in as a student; every other outside address and lookalikes are rejected; college addresses still work.
-- Rolls itself back and reports via RESULT. Replace the address if the allowlist changes.
do $$
declare r text := ''; role1 text;
begin
  insert into auth.users (id, email, instance_id, aud, role) values (gen_random_uuid(), 'KanhaiyaKumarSingh086@gmail.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  select role into role1 from public.profiles where email = 'kanhaiyakumarsingh086@gmail.com';
  r := r || 'allowed gmail -> role=' || coalesce(role1,'none') || '; ';
  begin insert into auth.users (id, email, instance_id, aud, role) values (gen_random_uuid(), 'someone.else@gmail.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'); r := r || 'other gmail ACCEPTED (bad); ';
  exception when others then r := r || 'other gmail rejected; '; end;
  begin insert into auth.users (id, email, instance_id, aud, role) values (gen_random_uuid(), 'x@nst.rishihood.edu.in.evil.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'); r := r || 'lookalike ACCEPTED (bad); ';
  exception when others then r := r || 'lookalike rejected; '; end;
  begin insert into auth.users (id, email, instance_id, aud, role) values (gen_random_uuid(), 'new.student@nst.rishihood.edu.in', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'); r := r || 'college address accepted; ';
  exception when others then r := r || 'college REJECTED (bad); '; end;
  raise exception 'RESULT: %', r;
end $$;
