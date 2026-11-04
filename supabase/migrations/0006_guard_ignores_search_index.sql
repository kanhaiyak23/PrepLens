-- 0006: refreshing the search index right after insert made every new post look "edited".
-- search_tsv is derived data, so it must not count as a content change.
create or replace function public.guard_experience() returns trigger
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
    if (to_jsonb(new) - 'upvote_count' - 'updated_at' - 'search_tsv') is distinct from (to_jsonb(old) - 'upvote_count' - 'updated_at' - 'search_tsv') then
      new.updated_at := now();
    else
      new.updated_at := old.updated_at;
    end if;
  end if;
  return new;
end $$;
