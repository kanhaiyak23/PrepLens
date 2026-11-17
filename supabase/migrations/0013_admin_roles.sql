-- 0013: admins can make other people admin, and remove admin access (ADR-31).
-- Rules, all enforced here (the API checks them too, for a fast and clear answer):
--   * only an admin may change a role; the target must already have a PrepLens account (they signed in once);
--   * nobody can remove their own admin access, and the last admin can never be removed;
--   * role changes are serialised by one transaction-scoped advisory lock, so two admins demoting each other at the
--     same moment cannot leave the archive with no admin (the second change sees the first one's result);
--   * every change is written to the append-only moderation log, with who it was about.

-- ---------------------------------------------------------------- moderation log: who a role change was about
alter table public.moderation_logs add column subject_id uuid references public.profiles (id) on delete set null;
alter table public.moderation_logs add column subject_email text;
create index modlog_subject on public.moderation_logs (subject_id);

alter table public.moderation_logs drop constraint moderation_logs_action_check;
alter table public.moderation_logs add constraint moderation_logs_action_check check (action in
  ('approve','reject','approve-update','reject-update','post-on-behalf','remove','reinstate','dismiss-report',
   'approve-company','merge-company','grant-admin','revoke-admin'));

-- ADR-10 still holds: rows never change. The only allowed UPDATE is a foreign-key cleanup that nulls a reference
-- (experience_id, report_id, and now subject_id) when the referenced row is deleted.
create or replace function public.moderation_logs_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
     and new.id = old.id and new.action = old.action and new.admin_id = old.admin_id
     and new.created_at = old.created_at
     and new.company_name is not distinct from old.company_name
     and new.role is not distinct from old.role
     and new.subject_email is not distinct from old.subject_email
     and (new.experience_id is null or new.experience_id = old.experience_id)
     and (new.report_id is null or new.report_id = old.report_id)
     and (new.subject_id is null or new.subject_id = old.subject_id) then
    return new;
  end if;
  raise exception 'The moderation log is append-only.' using errcode = 'P0001';
end $$;

-- ---------------------------------------------------------------- list the current admins
create function public.admin_list_admins() returns table (id uuid, email text, full_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED: Sign in required.' using errcode = 'P0001'; end if;
  if not public.is_admin() then raise exception 'FORBIDDEN: Admins only.' using errcode = 'P0001'; end if;
  return query select p.id, p.email, p.full_name, p.created_at from public.profiles p where p.role = 'admin' order by p.full_name, p.email;
end $$;

-- ---------------------------------------------------------------- the one place a role changes (not callable directly)
create function public._change_role(p_user uuid, p_role text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); target public.profiles; admins int;
begin
  if uid is null then raise exception 'UNAUTHENTICATED: Sign in required.' using errcode = 'P0001'; end if;
  if p_role not in ('student', 'admin') then raise exception 'VALIDATION: Unknown role.' using errcode = 'P0001'; end if;

  -- Critical section: one role change at a time across the whole archive. Released at commit or rollback.
  perform pg_advisory_xact_lock(hashtext('preplens.admin_roles'));

  -- Checked after the lock, not before: the caller may have been demoted by the change that held the lock.
  if not public.is_admin() then raise exception 'FORBIDDEN: Admins only.' using errcode = 'P0001'; end if;

  select * into target from public.profiles where id = p_user for update;
  if not found then raise exception 'NOT_FOUND: That account was not found.' using errcode = 'P0001'; end if;
  if target.role = p_role then
    raise exception 'CONFLICT: %', case p_role when 'admin' then target.email || ' is already an admin.' else target.email || ' is not an admin.' end
      using errcode = 'P0001';
  end if;

  if p_role = 'student' then
    if target.id = uid then raise exception 'FORBIDDEN: You cannot remove your own admin access. Ask another admin.' using errcode = 'P0001'; end if;
    select count(*) into admins from public.profiles where role = 'admin';
    if admins <= 1 then raise exception 'CONFLICT: PrepLens needs at least one admin.' using errcode = 'P0001'; end if;
    -- Otherwise a deleted-and-recreated account would be promoted again by the sign-up trigger.
    delete from public.admin_emails where email = target.email;
  end if;

  update public.profiles set role = p_role where id = target.id;
  insert into public.moderation_logs (action, admin_id, subject_id, subject_email)
  values (case p_role when 'admin' then 'grant-admin' else 'revoke-admin' end, uid, target.id, target.email);

  return jsonb_build_object('id', target.id, 'email', target.email, 'full_name', target.full_name, 'role', p_role, 'created_at', target.created_at);
end $$;

-- ---------------------------------------------------------------- public entry points
-- Grant by email: the admin knows the student's college address, not their id.
create function public.admin_grant_admin(p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED: Sign in required.' using errcode = 'P0001'; end if;
  if not public.is_admin() then raise exception 'FORBIDDEN: Admins only.' using errcode = 'P0001'; end if;
  select p.id into target from public.profiles p where p.email = lower(btrim(coalesce(p_email, '')));
  if target is null then
    raise exception 'NOT_FOUND: No PrepLens account uses that email yet. Ask them to sign in once, then try again.' using errcode = 'P0001';
  end if;
  return public._change_role(target, 'admin');
end $$;

-- Revoke by id: the admin picks someone from the list of current admins.
create function public.admin_revoke_admin(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  return public._change_role(p_user, 'student');
end $$;

revoke execute on function public.admin_list_admins() from public, anon, authenticated;
revoke execute on function public._change_role(uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_grant_admin(text) from public, anon, authenticated;
revoke execute on function public.admin_revoke_admin(uuid) from public, anon, authenticated;
grant execute on function public.admin_list_admins() to authenticated;
grant execute on function public.admin_grant_admin(text) to authenticated;
grant execute on function public.admin_revoke_admin(uuid) to authenticated;
