-- 0004: advisor fixes. Supabase's default privileges grant EXECUTE on new functions to anon/authenticated,
-- so the revoke in 0003 (which ran before the functions existed) did not cover them. Revoke now, then grant the intended set.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.list_experiences(text, text, text, int, text, text, timestamptz, uuid, int) to anon, authenticated;
grant execute on function public.get_experience(uuid) to anon, authenticated;
grant execute on function public.get_stats() to anon, authenticated;
grant execute on function public.list_my_experiences() to authenticated;
grant execute on function public.submit_experience(jsonb) to authenticated;
grant execute on function public.set_experience_visibility(uuid, boolean) to authenticated;
grant execute on function public.moderate_experience(uuid, text, text) to authenticated;
grant execute on function public.vote_experience(uuid, boolean) to authenticated;
grant execute on function public.bookmark_experience(uuid, boolean) to authenticated;
grant execute on function public.my_interactions(uuid[]) to authenticated;
grant execute on function public.report_experience(uuid, text, text) to authenticated;
grant execute on function public.check_rate_limit(text, text, int, int) to service_role;

-- Evaluate auth.uid() once per query, not once per row.
drop policy profiles_read_self on public.profiles;
drop policy profiles_update_self on public.profiles;
create policy profiles_read_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Foreign keys that are deleted through (ON DELETE) need a covering index.
create index bookmarks_experience on public.bookmarks (experience_id);
create index exp_reviewed_by on public.experiences (reviewed_by) where reviewed_by is not null;
create index modlog_report on public.moderation_logs (report_id) where report_id is not null;
create index reports_resolved_by on public.reports (resolved_by) where resolved_by is not null;
