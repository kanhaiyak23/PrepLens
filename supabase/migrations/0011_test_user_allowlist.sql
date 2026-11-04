-- ADR-05 amendment: the college-domain rule stays the default, but the owner can allow named
-- individual addresses (for testing the student side with a non-college account).
-- The list is a closed table: no grant, no policy, edited only through migrations or the SQL editor.
create table public.allowed_test_emails (
  email text primary key check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  note text,
  created_at timestamptz not null default now()
);
alter table public.allowed_test_emails enable row level security;
revoke all on public.allowed_test_emails from public, anon, authenticated;

create or replace function public.enforce_college_domain() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null and (
       lower(new.email) ~ '^[^@[:space:]]+@nst\.rishihood\.edu\.in$'
       or exists (select 1 from public.allowed_test_emails t where t.email = lower(new.email))
     ) then
    return new;
  end if;
  raise exception 'Only @nst.rishihood.edu.in accounts can sign in to PrepLens.' using errcode = 'P0001';
end $$;
revoke execute on function public.enforce_college_domain() from public, anon, authenticated;

insert into public.allowed_test_emails (email, note) values ('kanhaiyakumarsingh086@gmail.com', 'owner test student account');
