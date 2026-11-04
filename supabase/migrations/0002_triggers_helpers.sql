-- 0002: auth domain rule (ADR-05), profile creation, lifecycle guard (ADR-15), counters (ADR-07), append-only log (ADR-10).

create function public.slugify(t text) returns text
language sql immutable set search_path = '' as $$
  select trim(both '-' from regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', '-', 'g'))
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
$$;

-- ADR-05: reject any signup outside the college domain, in the database, by exact match.
create function public.enforce_college_domain() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or lower(new.email) !~ '^[^@[:space:]]+@nst\.rishihood\.edu\.in$' then
    raise exception 'Only @nst.rishihood.edu.in accounts can sign in to PrepLens.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger enforce_college_domain
  before insert or update of email on auth.users
  for each row execute function public.enforce_college_domain();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    lower(new.email),
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)), 120),
    new.raw_user_meta_data ->> 'avatar_url',
    case when exists (select 1 from public.admin_emails a where a.email = lower(new.email)) then 'admin' else 'student' end
  );
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ADR-15: one place that decides which status changes are legal, and that stamps updated_at only on real content changes.
create function public.guard_experience() returns trigger
language plpgsql set search_path = '' as $$
declare legal boolean;
begin
  if tg_op = 'INSERT'
     or new.interview_year is distinct from old.interview_year
     or new.interview_month is distinct from old.interview_month then
    if (new.interview_year, coalesce(new.interview_month, 1))
       > (extract(year from now())::int, extract(month from now())::int) then
      raise exception 'VALIDATION: The interview date cannot be in the future.' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.status <> old.status then
      legal := (old.status, new.status) in (
        ('pending','published'), ('pending','rejected'), ('pending','unpublished'),
        ('rejected','pending'), ('published','unpublished'), ('unpublished','pending'),
        ('published','removed'), ('removed','pending'));
      if not legal then
        raise exception 'CONFLICT: Illegal status change from % to %.', old.status, new.status using errcode = 'P0001';
      end if;
    end if;
    -- votes change upvote_count only; that must not look like an edit (the AI guide fingerprint uses updated_at).
    if (to_jsonb(new) - 'upvote_count' - 'updated_at') is distinct from (to_jsonb(old) - 'upvote_count' - 'updated_at') then
      new.updated_at := now();
    else
      new.updated_at := old.updated_at;
    end if;
  end if;
  return new;
end $$;
create trigger guard_experience
  before insert or update on public.experiences
  for each row execute function public.guard_experience();

create function public.sync_company_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'published' then
      update public.companies set experience_count = experience_count + 1 where id = new.company_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.status <> 'published' and new.status = 'published' then
      update public.companies set experience_count = experience_count + 1 where id = new.company_id;
    elsif old.status = 'published' and new.status <> 'published' then
      update public.companies set experience_count = greatest(experience_count - 1, 0) where id = new.company_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.status = 'published' then
      update public.companies set experience_count = greatest(experience_count - 1, 0) where id = old.company_id;
    end if;
  end if;
  return null;
end $$;
create trigger sync_company_count
  after insert or update of status or delete on public.experiences
  for each row execute function public.sync_company_count();

create function public.sync_upvote_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.experiences set upvote_count = upvote_count + 1 where id = new.experience_id;
  else
    update public.experiences set upvote_count = greatest(upvote_count - 1, 0) where id = old.experience_id;
  end if;
  return null;
end $$;
create trigger sync_upvote_count
  after insert or delete on public.votes
  for each row execute function public.sync_upvote_count();

-- ADR-10: rows are added, never changed or removed. The only allowed UPDATE is the foreign-key
-- cleanup that nulls experience_id / report_id when the referenced row is deleted.
create function public.moderation_logs_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
     and new.id = old.id and new.action = old.action and new.admin_id = old.admin_id
     and new.created_at = old.created_at
     and new.company_name is not distinct from old.company_name
     and new.role is not distinct from old.role
     and (new.experience_id is null or new.experience_id = old.experience_id)
     and (new.report_id is null or new.report_id = old.report_id) then
    return new;
  end if;
  raise exception 'The moderation log is append-only.' using errcode = 'P0001';
end $$;
create trigger moderation_logs_immutable
  before update or delete on public.moderation_logs
  for each row execute function public.moderation_logs_immutable();

-- ADR-17: weighted full-text document. Question text matters most, tips least.
create function public.refresh_experience_search(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.experiences e set search_tsv =
    setweight(to_tsvector('english', coalesce((select string_agg(q.text, ' ') from public.interview_rounds r join public.questions q on q.round_id = r.id where r.experience_id = e.id), '')), 'A') ||
    setweight(to_tsvector('english', coalesce(e.company_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(e.role, '')), 'C') ||
    setweight(to_tsvector('english', coalesce((select string_agg(r.tips, ' ') from public.interview_rounds r where r.experience_id = e.id), '')), 'D')
  where e.id = p_id
$$;
