-- 0007: the published experiences behind one company's AI guide (ADR-12). Public data only: the author is already
-- anonymised by _author_json, and unpublished posts are never included, so a withdrawn post cannot feed a guide.
create function public.list_company_sources(p_slug text, p_limit int default 30) returns jsonb
language sql stable security definer set search_path = '' as $$
  select (
    select jsonb_build_object(
      'company', jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug),
      'experiences', coalesce((
        select jsonb_agg(t.x order by t.created_at desc, t.id desc)
        from (
          select e.created_at, e.id, jsonb_build_object(
            'id', e.id, 'role', e.role, 'drive_type', e.drive_type, 'interview_year', e.interview_year,
            'outcome', e.outcome, 'updated_at', e.updated_at,
            'author', public._author_json(e.is_anonymous, e.author_id, e.author_name, e.author_batch, e.author_branch, e.consented_at),
            'rounds', (select coalesce(jsonb_agg(jsonb_build_object('name', r.name, 'tips', r.tips,
                'questions', (select coalesce(jsonb_agg(jsonb_build_object('text', q.text, 'topic', q.topic) order by q.position), '[]'::jsonb)
                              from public.questions q where q.round_id = r.id)) order by r.position), '[]'::jsonb)
              from public.interview_rounds r where r.experience_id = e.id)) as x
          from public.experiences e
          where e.company_id = c.id and e.status = 'published'
          order by e.created_at desc, e.id desc
          limit least(greatest(coalesce(p_limit, 30), 1), 50)
        ) t), '[]'::jsonb))
    from public.companies c where c.slug = p_slug and c.status = 'active')
$$;
revoke execute on function public.list_company_sources(text, int) from public, anon, authenticated;
grant execute on function public.list_company_sources(text, int) to anon, authenticated;
