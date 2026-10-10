-- Trilha Sênior — modelos de leitura (esquema "app").
-- Montam, em SQL, os JSON consumidos pelo front-end. O XP é SEMPRE derivado do estado dos registros
-- (nunca um contador): desmarcar/reabrir algo remove o XP correspondente na próxima leitura.
-- Todas as funções recebem o uid explicitamente e rodam com os privilégios de quem chama (RLS vale).

-- ───────────── Tópicos e trilhas ─────────────

-- Tópicos ativos (de trilhas ativas) com o status do usuário.
create or replace function app.topic_rows(p_uid uuid)
returns table (
  id bigint, slug text, title text, description text, career_level text, difficulty int, pos int,
  track_id bigint, track_slug text, track_title text, track_required boolean, track_position int,
  status text, started_at timestamptz, completed_at timestamptz
)
language sql stable
set search_path = ''
as $$
  select t.id, t.slug, t.title, t.description, t.career_level, t.difficulty::int, t.position,
         tr.id, tr.slug, tr.title, tr.required, tr.position,
         coalesce(p.status, 'not_started'), p.started_at, p.completed_at
  from app.topics t
  join app.tracks tr on tr.id = t.track_id
  left join app.topic_progress p on p.topic_id = t.id and p.user_id = p_uid
  where t.archived_at is null and tr.archived_at is null
$$;

-- Resumo de cada tópico (com checklist e "recomendado estudar antes"), na ordem do roadmap.
create or replace function app.topic_summaries(p_uid uuid)
returns table (
  topic_id bigint, slug text, track_slug text, career_level text, status text,
  track_position int, pos int, summary jsonb
)
language sql stable
set search_path = ''
as $$
  with rows as materialized (
    select * from app.topic_rows(p_uid)
  ),
  counts as (
    select ci.topic_id, count(*) as total, count(cp.checklist_item_id) as checked
    from app.checklist_items ci
    left join app.checklist_progress cp on cp.checklist_item_id = ci.id and cp.user_id = p_uid
    where ci.archived_at is null
    group by ci.topic_id
  )
  select r.id, r.slug, r.track_slug, r.career_level, r.status, r.track_position, r.pos,
    jsonb_build_object(
      'slug', r.slug,
      'title', r.title,
      'description', r.description,
      'trackSlug', r.track_slug,
      'trackTitle', r.track_title,
      'careerLevel', r.career_level,
      'difficulty', r.difficulty,
      'xp', app.topic_xp(r.difficulty),
      'status', r.status,
      'checklistTotal', coalesce(c.total, 0),
      'checklistChecked', coalesce(c.checked, 0),
      'completedAt', r.completed_at,
      -- pré-requisitos ainda não concluídos: "recomendado estudar antes" (nunca impede marcar)
      'recommendedFirst', coalesce((
        select jsonb_agg(
                 jsonb_build_object('slug', pr.slug, 'title', pr.title, 'status', pr.status)
                 order by pr.track_position, pr.pos)
        from app.topic_prerequisites tp
        join rows pr on pr.id = tp.prerequisite_id
        where tp.topic_id = r.id and pr.status <> 'completed'
      ), '[]'::jsonb)
    )
  from rows r
  left join counts c on c.topic_id = r.id
  order by r.track_position, r.pos
$$;

create or replace function app.topic_detail(p_uid uuid, p_slug text)
returns jsonb
language plpgsql stable
set search_path = ''
as $$
declare
  v_summary jsonb;
  v_topic_id bigint;
  v_progress app.topic_progress;
begin
  select s.summary, s.topic_id into v_summary, v_topic_id
    from app.topic_summaries(p_uid) s
   where s.slug = p_slug;

  if v_topic_id is null then
    perform app.not_found('Tópico');
  end if;

  select * into v_progress
    from app.topic_progress p
   where p.user_id = p_uid and p.topic_id = v_topic_id;

  return v_summary || jsonb_build_object(
    'checklist', coalesce((
      select jsonb_agg(
               jsonb_build_object('key', ci.key, 'text', ci.text, 'checked', cp.checklist_item_id is not null)
               order by ci.position, ci.id)
      from app.checklist_items ci
      left join app.checklist_progress cp on cp.checklist_item_id = ci.id and cp.user_id = p_uid
      where ci.topic_id = v_topic_id and ci.archived_at is null
    ), '[]'::jsonb),
    'resources', coalesce((
      select jsonb_agg(jsonb_build_object('name', r.name, 'url', r.url) order by r.position, r.id)
      from app.topic_resources r
      where r.topic_id = v_topic_id
    ), '[]'::jsonb),
    'prerequisites', coalesce((
      select jsonb_agg(
               jsonb_build_object('slug', pr.slug, 'title', pr.title, 'status', pr.status)
               order by pr.track_position, pr.pos)
      from app.topic_prerequisites tp
      join app.topic_rows(p_uid) pr on pr.id = tp.prerequisite_id
      where tp.topic_id = v_topic_id
    ), '[]'::jsonb),
    'notes', coalesce(v_progress.notes, ''),
    'evidenceUrl', v_progress.evidence_url,
    'startedAt', v_progress.started_at,
    'masteredDirectly', coalesce(v_progress.mastered_directly, false),
    'reviews', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', rv.id, 'intervalDays', rv.interval_days, 'dueOn', rv.due_on, 'completedAt', rv.completed_at)
               order by rv.interval_days, rv.id)
      from app.reviews rv
      where rv.user_id = p_uid and rv.topic_id = v_topic_id
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object('slug', pj.slug, 'title', pj.title) order by pj.position, pj.id)
      from app.project_topics pt
      join app.projects pj on pj.id = pt.project_id
      where pt.topic_id = v_topic_id and pj.archived_at is null
    ), '[]'::jsonb)
  );
end
$$;

create or replace function app.track_summaries(p_uid uuid)
returns jsonb
language sql stable
set search_path = ''
as $$
  with agg as (
    select r.track_slug,
           count(*) as total,
           count(*) filter (where r.status = 'completed') as done,
           count(*) filter (where r.status = 'studying') as studying,
           coalesce(sum(app.topic_xp(r.difficulty)), 0) as total_xp,
           coalesce(sum(app.topic_xp(r.difficulty)) filter (where r.status = 'completed'), 0) as earned_xp
    from app.topic_rows(p_uid) r
    group by r.track_slug
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'slug', tr.slug,
             'title', tr.title,
             'description', tr.description,
             'position', tr.position,
             'required', tr.required,
             'totalTopics', coalesce(a.total, 0),
             'completedTopics', coalesce(a.done, 0),
             'studyingTopics', coalesce(a.studying, 0),
             'percent', case when coalesce(a.total, 0) = 0 then 0 else (a.done * 100) / a.total end,
             'totalXp', coalesce(a.total_xp, 0),
             'earnedXp', coalesce(a.earned_xp, 0))
           order by tr.position, tr.id), '[]'::jsonb)
  from app.tracks tr
  left join agg a on a.track_slug = tr.slug
  where tr.archived_at is null
$$;

-- ───────────── Projetos ─────────────

create or replace function app.project_rows(p_uid uuid, p_include_archived boolean default false)
returns table (
  id bigint, slug text, title text, description text, career_level text, difficulty int, pos int,
  archived boolean, repository_url text, deploy_url text,
  milestones_total int, milestones_completed int, milestones_in_progress int,
  active_xp int, completed_xp int, finished boolean
)
language sql stable
set search_path = ''
as $$
  with ms as (
    select m.project_id,
           count(*) filter (where m.archived_at is null) as total,
           count(*) filter (where m.archived_at is null and mp.status = 'completed') as done,
           count(*) filter (where m.archived_at is null and mp.status = 'in_progress') as in_progress,
           coalesce(sum(m.xp) filter (where m.archived_at is null), 0) as active_xp,
           coalesce(sum(m.xp) filter (where mp.status = 'completed'), 0) as completed_xp
    from app.milestones m
    left join app.milestone_progress mp on mp.milestone_id = m.id and mp.user_id = p_uid
    group by m.project_id
  )
  select p.id, p.slug, p.title, p.description, p.career_level, p.difficulty::int, p.position,
         p.archived_at is not null, pp.repository_url, pp.deploy_url,
         coalesce(ms.total, 0)::int, coalesce(ms.done, 0)::int, coalesce(ms.in_progress, 0)::int,
         coalesce(ms.active_xp, 0)::int, coalesce(ms.completed_xp, 0)::int,
         -- finalizado: todas as etapas ATIVAS concluídas (derivado, nunca armazenado)
         (coalesce(ms.total, 0) > 0 and ms.done = ms.total)
  from app.projects p
  left join ms on ms.project_id = p.id
  left join app.project_progress pp on pp.project_id = p.id and pp.user_id = p_uid
  where p_include_archived or p.archived_at is null
$$;

create or replace function app.project_summaries(p_uid uuid)
returns table (slug text, pos int, summary jsonb)
language sql stable
set search_path = ''
as $$
  select r.slug, r.pos,
    jsonb_build_object(
      'slug', r.slug,
      'title', r.title,
      'description', r.description,
      'careerLevel', r.career_level,
      'difficulty', r.difficulty,
      'status', case
        when r.finished then 'finished'
        when r.milestones_completed > 0 or r.milestones_in_progress > 0
             or r.repository_url is not null or r.deploy_url is not null then 'in_progress'
        else 'not_started'
      end,
      'milestonesTotal', r.milestones_total,
      'milestonesCompleted', r.milestones_completed,
      -- máximo possível: etapas + 100 (finalizar) + 50 (repositório) + 50 (deploy)
      'totalXp', r.active_xp + 200,
      'earnedXp', r.completed_xp + app.project_bonus_total(r.finished, r.repository_url is not null, r.deploy_url is not null),
      'repositoryUrl', r.repository_url,
      'deployUrl', r.deploy_url
    )
  from app.project_rows(p_uid) r
  order by r.pos, r.id
$$;

create or replace function app.project_detail(p_uid uuid, p_slug text)
returns jsonb
language plpgsql stable
set search_path = ''
as $$
declare
  v_row record;
  v_summary jsonb;
begin
  select r.* into v_row from app.project_rows(p_uid) r where r.slug = p_slug;
  if v_row.id is null then
    perform app.not_found('Projeto');
  end if;

  select s.summary into v_summary from app.project_summaries(p_uid) s where s.slug = p_slug;

  return v_summary || jsonb_build_object(
    'milestones', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'key', m.key,
                 'title', m.title,
                 'acceptanceCriteria', m.acceptance_criteria,
                 'xp', m.xp,
                 'status', coalesce(mp.status, 'pending'),
                 'completedAt', mp.completed_at)
               order by m.position, m.id)
      from app.milestones m
      left join app.milestone_progress mp on mp.milestone_id = m.id and mp.user_id = p_uid
      where m.project_id = v_row.id and m.archived_at is null
    ), '[]'::jsonb),
    'topics', coalesce((
      select jsonb_agg(
               jsonb_build_object('slug', t.slug, 'title', t.title, 'status', coalesce(tp.status, 'not_started'))
               order by tr.position, t.position, t.id)
      from app.project_topics pt
      join app.topics t on t.id = pt.topic_id and t.archived_at is null
      join app.tracks tr on tr.id = t.track_id
      left join app.topic_progress tp on tp.topic_id = t.id and tp.user_id = p_uid
      where pt.project_id = v_row.id
    ), '[]'::jsonb),
    'bonus', app.project_bonus(v_row.finished, v_row.repository_url is not null, v_row.deploy_url is not null)
  );
end
$$;

-- ───────────── Revisões espaçadas ─────────────

create or replace function app.review_json(p_uid uuid, p_review_id bigint)
returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
           'id', r.id,
           'topic', jsonb_build_object('slug', t.slug, 'title', t.title),
           'intervalDays', r.interval_days,
           'dueOn', r.due_on,
           'completedAt', r.completed_at,
           'xp', app.review_xp(t.difficulty),
           'overdue', r.completed_at is null and r.due_on < app.today(p_uid))
  from app.reviews r
  join app.topics t on t.id = r.topic_id
  where r.user_id = p_uid and r.id = p_review_id
$$;

-- Fila de revisões. 'today' inclui as atrasadas (due_on <= hoje) ainda não concluídas.
create or replace function app.review_list(p_uid uuid, p_scope text)
returns jsonb
language sql stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(app.review_json(p_uid, r.id) order by r.due_on, r.id), '[]'::jsonb)
  from app.reviews r
  where r.user_id = p_uid
    and case p_scope
      when 'today' then r.completed_at is null and r.due_on <= app.today(p_uid)
      when 'upcoming' then r.completed_at is null and r.due_on > app.today(p_uid)
      when 'pending' then r.completed_at is null
      when 'completed' then r.completed_at is not null
      else true
    end
$$;

-- ───────────── XP, streak e perfil ─────────────

create or replace function app.xp_breakdown(p_uid uuid)
returns jsonb
language plpgsql stable
set search_path = ''
as $$
declare
  v_topics int;
  v_milestones int;
  v_projects int;
  v_reviews int;
begin
  select coalesce(sum(app.topic_xp(t.difficulty)), 0) into v_topics
    from app.topic_progress p
    join app.topics t on t.id = p.topic_id
   where p.user_id = p_uid and p.status = 'completed';

  select coalesce(sum(m.xp), 0) into v_milestones
    from app.milestone_progress mp
    join app.milestones m on m.id = mp.milestone_id
   where mp.user_id = p_uid and mp.status = 'completed';

  select coalesce(sum(app.project_bonus_total(r.finished, r.repository_url is not null, r.deploy_url is not null)), 0)
    into v_projects
    from app.project_rows(p_uid, true) r;

  select coalesce(sum(app.review_xp(t.difficulty)), 0) into v_reviews
    from app.reviews rv
    join app.topics t on t.id = rv.topic_id
   where rv.user_id = p_uid and rv.completed_at is not null;

  return jsonb_build_object(
    'topics', v_topics,
    'milestones', v_milestones,
    'projects', v_projects,
    'reviews', v_reviews,
    'total', v_topics + v_milestones + v_projects + v_reviews
  );
end
$$;

-- Nível de carreira: % mínima (40/60/80) dos tópicos das trilhas OBRIGATÓRIAS até aquele nível; níveis sequenciais.
create or replace function app.career_evaluation(p_uid uuid)
returns jsonb
language plpgsql stable
set search_path = ''
as $$
declare
  v_targets text[] := array['junior', 'mid', 'senior'];
  v_thresholds int[] := array[40, 60, 80];
  v_blocked boolean := false;
  v_current text := 'beginner';
  v_progress jsonb := '[]'::jsonb;
  v_next jsonb := null;
  v_entry jsonb;
  v_rank int;
  v_total int;
  v_done int;
  v_percent int;
  v_reached boolean;
  i int;
begin
  for i in 1 .. 3 loop
    v_rank := app.career_rank(v_targets[i]);

    select count(*), count(*) filter (where r.status = 'completed')
      into v_total, v_done
      from app.topic_rows(p_uid) r
     where r.track_required and app.career_rank(r.career_level) <= v_rank;

    v_percent := case when v_total = 0 then 0 else (v_done * 100) / v_total end;
    v_reached := not v_blocked and v_total > 0 and v_percent >= v_thresholds[i];

    if v_reached then
      v_current := v_targets[i];
    else
      v_blocked := true;
    end if;

    v_entry := jsonb_build_object(
      'level', v_targets[i],
      'requiredPercent', v_thresholds[i],
      'percent', v_percent,
      'reached', v_reached
    );
    v_progress := v_progress || jsonb_build_array(v_entry);
    if v_next is null and not v_reached then
      v_next := v_entry;
    end if;
  end loop;

  return jsonb_build_object('level', v_current, 'next', v_next, 'progress', v_progress);
end
$$;

-- Streak diário: continua "vivo" se o último dia estudado foi hoje ou ontem. Quebrar o streak não tira XP.
create or replace function app.streak_info(p_uid uuid)
returns jsonb
language plpgsql stable
set search_path = ''
as $$
declare
  v_today date := app.today(p_uid);
  v_longest int;
  v_current int;
  v_studied_today boolean;
begin
  with d as (
    select distinct s.studied_on from app.study_sessions s where s.user_id = p_uid
  ), g as (
    select d.studied_on, d.studied_on - (row_number() over (order by d.studied_on))::int as grp from d
  ), runs as (
    select count(*) as len from g group by grp
  )
  select coalesce(max(len), 0) into v_longest from runs;

  with d as (
    select distinct s.studied_on from app.study_sessions s where s.user_id = p_uid and s.studied_on <= v_today
  ), g as (
    select d.studied_on, d.studied_on - (row_number() over (order by d.studied_on))::int as grp from d
  ), runs as (
    select count(*) as len, max(studied_on) as last_day from g group by grp
  )
  select coalesce(max(len), 0) into v_current from runs where last_day >= v_today - 1;

  select exists (
    select 1 from app.study_sessions s where s.user_id = p_uid and s.studied_on = v_today
  ) into v_studied_today;

  return jsonb_build_object('current', v_current, 'longest', v_longest, 'studiedToday', v_studied_today);
end
$$;

-- Perfil: XP, nível, carreira, progresso geral, streak e meta semanal (semana de segunda a domingo).
create or replace function app.profile(p_uid uuid)
returns jsonb
language plpgsql stable
set search_path = ''
as $$
declare
  v_xp jsonb := app.xp_breakdown(p_uid);
  v_level jsonb := app.level_info((v_xp ->> 'total')::int);
  v_streak jsonb := app.streak_info(p_uid);
  v_today date := app.today(p_uid);
  v_week_start date := date_trunc('week', app.today(p_uid)::timestamp)::date;
  v_all int;
  v_done int;
  v_weekly int;
begin
  select count(*), count(*) filter (where r.status = 'completed')
    into v_all, v_done
    from app.topic_rows(p_uid) r;

  select count(*) into v_weekly
    from app.study_sessions s
   where s.user_id = p_uid and s.studied_on between v_week_start and v_week_start + 6;

  return jsonb_build_object(
    'xp', v_level || jsonb_build_object(
      'total', (v_xp ->> 'total')::int,
      'breakdown', jsonb_build_object(
        'topics', v_xp -> 'topics',
        'milestones', v_xp -> 'milestones',
        'projects', v_xp -> 'projects',
        'reviews', v_xp -> 'reviews')),
    'career', app.career_evaluation(p_uid),
    'overall', jsonb_build_object(
      'completedTopics', v_done,
      'totalTopics', v_all,
      'percent', case when v_all = 0 then 0 else (v_done * 100) / v_all end),
    'streak', jsonb_build_object(
      'current', v_streak -> 'current',
      'longest', v_streak -> 'longest',
      'studiedToday', v_streak -> 'studiedToday',
      'weeklySessions', v_weekly,
      'weeklyGoal', app.user_weekly_goal(p_uid)),
    'timezone', app.user_timezone(p_uid)
  );
end
$$;

-- Resposta padrão das mutações: o recurso atualizado + o perfil recalculado no servidor.
create or replace function app.mutation(p_uid uuid, p_data jsonb)
returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object('data', p_data, 'profile', app.profile(p_uid))
$$;

-- ───────────── Dashboard e grafo ─────────────

create or replace function app.dashboard(p_uid uuid)
returns jsonb
language plpgsql stable
set search_path = ''
as $$
declare
  v_week_start date := date_trunc('week', app.today(p_uid)::timestamp)::date;
begin
  return jsonb_build_object(
    'profile', app.profile(p_uid),
    'radar', coalesce((
      select jsonb_agg(
               jsonb_build_object('trackSlug', t ->> 'slug', 'title', t ->> 'title', 'percent', (t ->> 'percent')::int)
               order by ord)
      from jsonb_array_elements(app.track_summaries(p_uid)) with ordinality as x(t, ord)
    ), '[]'::jsonb),
    'weeks', (
      select jsonb_agg(
               jsonb_build_object(
                 'weekStart', w.week_start,
                 'sessions', coalesce(s.sessions, 0),
                 'minutes', coalesce(s.minutes, 0))
               order by w.week_start)
      from (select v_week_start - 7 * g as week_start from generate_series(0, 11) as g) w
      left join lateral (
        select count(*) as sessions, sum(ss.duration_minutes) as minutes
        from app.study_sessions ss
        where ss.user_id = p_uid and ss.studied_on between w.week_start and w.week_start + 6
      ) s on true
    ),
    'totals', (
      select jsonb_build_object('sessions', count(*), 'minutes', coalesce(sum(ss.duration_minutes), 0))
      from app.study_sessions ss
      where ss.user_id = p_uid
    )
  );
end
$$;

-- Grafo de pré-requisitos. "unlocked" = todos os pré-requisitos concluídos; bloqueado é só recomendação.
create or replace function app.graph(p_uid uuid)
returns jsonb
language sql stable
set search_path = ''
as $$
  with rows as materialized (
    select * from app.topic_rows(p_uid)
  ), edges as (
    select src.slug as source, dst.slug as target, src.status as source_status,
           dst.track_position as t_track, dst.pos as t_position
    from app.topic_prerequisites tp
    join rows dst on dst.id = tp.topic_id
    join rows src on src.id = tp.prerequisite_id
  ), blocked as (
    select e.target, array_agg(e.source order by e.source) as blocked_by
    from edges e
    where e.source_status <> 'completed'
    group by e.target
  )
  select jsonb_build_object(
    'nodes', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'slug', r.slug,
                 'title', r.title,
                 'trackSlug', r.track_slug,
                 'trackTitle', r.track_title,
                 'careerLevel', r.career_level,
                 'difficulty', r.difficulty,
                 'status', r.status,
                 'unlocked', b.blocked_by is null,
                 'blockedBy', to_jsonb(coalesce(b.blocked_by, array[]::text[])))
               order by r.track_position, r.pos)
      from rows r
      left join blocked b on b.target = r.slug
    ), '[]'::jsonb),
    'edges', coalesce((
      select jsonb_agg(
               jsonb_build_object('source', e.source, 'target', e.target)
               order by e.t_track, e.t_position, e.source)
      from edges e
    ), '[]'::jsonb)
  )
$$;
