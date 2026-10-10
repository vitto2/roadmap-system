-- Trilha Sênior — ações (mutações) e validações no esquema "app".
-- As funções públicas (RPC) da migration seguinte só orquestram estas peças e devolvem { data, profile }.

-- ───────────── Validação ─────────────

create or replace function app.add_error(p_errors jsonb, p_field text, p_message text)
returns jsonb
language sql immutable
set search_path = ''
as $$
  select jsonb_set(
    coalesce(p_errors, '{}'::jsonb),
    array[p_field],
    coalesce(p_errors -> p_field, '[]'::jsonb) || to_jsonb(p_message)
  )
$$;

-- 422 com os erros por campo. Se houver um único erro, a mensagem principal é ele mesmo.
create or replace function app.raise_validation(p_errors jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_message text := 'Os dados enviados são inválidos.';
begin
  if p_errors is null or p_errors = '{}'::jsonb then
    return;
  end if;
  if (select count(*) from jsonb_each(p_errors)) = 1
     and (select jsonb_array_length(value) from jsonb_each(p_errors) limit 1) = 1 then
    v_message := (select value ->> 0 from jsonb_each(p_errors) limit 1);
  end if;
  perform app.fail(422, 'validation_failed', v_message, p_errors);
end
$$;

-- 'AAAA-MM-DD' válido -> date; qualquer outra coisa -> null.
create or replace function app.parse_date(p_value jsonb)
returns date
language plpgsql immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_value) is distinct from 'string' or (p_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  return (p_value #>> '{}')::date;
exception when others then
  return null;
end
$$;

-- Número inteiro dentro de [p_min, p_max]; senão null.
create or replace function app.parse_int(p_value jsonb, p_min int, p_max int)
returns int
language plpgsql immutable
set search_path = ''
as $$
declare
  v_number numeric;
begin
  if jsonb_typeof(p_value) is distinct from 'number' then
    return null;
  end if;
  v_number := (p_value #>> '{}')::numeric;
  if v_number <> trunc(v_number) or v_number < p_min or v_number > p_max then
    return null;
  end if;
  return v_number::int;
end
$$;

-- URL http(s) opcional: null/'' -> null (limpa); inválida -> erro no campo.
create or replace function app.normalize_url(p_value jsonb, p_field text, inout p_errors jsonb, out p_url text)
language plpgsql immutable
set search_path = ''
as $$
declare
  v_text text;
begin
  p_url := null;
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return;
  end if;
  if jsonb_typeof(p_value) <> 'string' then
    p_errors := app.add_error(p_errors, p_field, 'Informe um link http(s) válido.');
    return;
  end if;
  v_text := btrim(p_value #>> '{}');
  if v_text = '' then
    return;
  end if;
  if v_text !~* '^https?://[^\s]+$' or char_length(v_text) > 500 then
    p_errors := app.add_error(p_errors, p_field, 'Informe um link http(s) válido.');
    return;
  end if;
  p_url := v_text;
end
$$;

-- ───────────── Tópicos ─────────────

create or replace function app.find_topic(p_slug text)
returns bigint
language plpgsql stable
set search_path = ''
as $$
declare
  v_id bigint;
begin
  select t.id into v_id from app.topics t where t.slug = p_slug and t.archived_at is null;
  if v_id is null then
    perform app.not_found('Tópico');
  end if;
  return v_id;
end
$$;

create or replace function app.ensure_progress(p_uid uuid, p_topic_id bigint)
returns app.topic_progress
language plpgsql
set search_path = ''
as $$
declare
  v_progress app.topic_progress;
begin
  insert into app.topic_progress (user_id, topic_id)
  values (p_uid, p_topic_id)
  on conflict (user_id, topic_id) do nothing;

  select * into v_progress
    from app.topic_progress p
   where p.user_id = p_uid and p.topic_id = p_topic_id;
  return v_progress;
end
$$;

-- Desfaz a conclusão: o XP do tópico e das revisões deixa de contar (é derivado) e as revisões são apagadas.
create or replace function app.reopen_topic(p_uid uuid, p_topic_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update app.topic_progress
     set status = 'studying', completed_at = null, mastered_directly = false, updated_at = app.now()
   where user_id = p_uid and topic_id = p_topic_id;

  delete from app.reviews where user_id = p_uid and topic_id = p_topic_id;
end
$$;

-- Conclui o tópico e agenda revisões em 7, 30 e 90 dias (só 90 dias quando "Já domino"), no fuso do usuário.
create or replace function app.finish_topic(p_uid uuid, p_topic_id bigint, p_mastered boolean)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_today date := app.today(p_uid);
begin
  update app.topic_progress
     set status = 'completed',
         completed_at = app.now(),
         started_at = coalesce(started_at, app.now()),
         mastered_directly = p_mastered,
         updated_at = app.now()
   where user_id = p_uid and topic_id = p_topic_id;

  delete from app.reviews where user_id = p_uid and topic_id = p_topic_id;

  insert into app.reviews (user_id, topic_id, interval_days, due_on)
  select p_uid, p_topic_id, d, v_today + d
    from unnest(case when p_mastered then array[90] else array[7, 30, 90] end) as d;
end
$$;

-- ───────────── Diário de estudo ─────────────

create or replace function app.session_json(p_uid uuid, p_session_id bigint)
returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
           'id', s.id,
           'studiedOn', s.studied_on,
           'durationMinutes', s.duration_minutes,
           'topic', case when t.id is null then null else jsonb_build_object('slug', t.slug, 'title', t.title) end,
           'note', s.note)
  from app.study_sessions s
  left join app.topics t on t.id = s.topic_id
  where s.user_id = p_uid and s.id = p_session_id
$$;

-- Valida a entrada de uma sessão e devolve os valores normalizados.
create or replace function app.validate_session_input(p_uid uuid, p_input jsonb, p_default_date date)
returns jsonb
language plpgsql stable
set search_path = ''
as $$
declare
  v_errors jsonb := '{}'::jsonb;
  v_duration int;
  v_date date := p_default_date;
  v_topic_id bigint;
  v_note text := '';
  v_slug text;
begin
  if jsonb_typeof(p_input) is distinct from 'object' then
    perform app.fail(422, 'validation_failed', 'Os dados enviados são inválidos.',
                     jsonb_build_object('request', jsonb_build_array('Envie um objeto JSON.')));
  end if;

  v_duration := app.parse_int(p_input -> 'durationMinutes', 1, 1440);
  if v_duration is null then
    v_errors := app.add_error(v_errors, 'durationMinutes', 'Informe a duração em minutos (de 1 a 1440).');
  end if;

  if p_input ? 'studiedOn' and jsonb_typeof(p_input -> 'studiedOn') <> 'null' then
    v_date := app.parse_date(p_input -> 'studiedOn');
    if v_date is null then
      v_errors := app.add_error(v_errors, 'studiedOn', 'Use o formato AAAA-MM-DD.');
    elsif v_date > app.today(p_uid) then
      v_errors := app.add_error(v_errors, 'studiedOn', 'A data da sessão não pode estar no futuro.');
    end if;
  end if;

  if p_input ? 'topicSlug' and jsonb_typeof(p_input -> 'topicSlug') <> 'null' then
    if jsonb_typeof(p_input -> 'topicSlug') <> 'string' then
      v_errors := app.add_error(v_errors, 'topicSlug', 'Tópico inválido.');
    else
      v_slug := p_input ->> 'topicSlug';
      if v_slug <> '' then
        select t.id into v_topic_id from app.topics t where t.slug = v_slug and t.archived_at is null;
        if v_topic_id is null then
          v_errors := app.add_error(v_errors, 'topicSlug', 'Tópico informado não existe.');
        end if;
      end if;
    end if;
  end if;

  if p_input ? 'note' and jsonb_typeof(p_input -> 'note') <> 'null' then
    if jsonb_typeof(p_input -> 'note') <> 'string' or char_length(p_input ->> 'note') > 500 then
      v_errors := app.add_error(v_errors, 'note', 'A nota deve ter até 500 caracteres.');
    else
      v_note := p_input ->> 'note';
    end if;
  end if;

  perform app.raise_validation(v_errors);

  return jsonb_build_object(
    'studiedOn', v_date,
    'durationMinutes', v_duration,
    'topicId', v_topic_id,
    'note', v_note
  );
end
$$;

-- ───────────── Backup / restauração do progresso (por slug, sobrevive a re-seed) ─────────────

create or replace function app.export_backup(p_uid uuid)
returns jsonb
language plpgsql stable
set search_path = ''
as $$
begin
  return jsonb_build_object(
    'version', 1,
    'exportedAt', app.now(),
    'settings', jsonb_build_object(
      'timezone', app.user_timezone(p_uid),
      'weeklyGoal', app.user_weekly_goal(p_uid)),
    'topics', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'slug', t.slug,
                 'status', p.status,
                 'notes', p.notes,
                 'evidenceUrl', p.evidence_url,
                 'startedAt', p.started_at,
                 'completedAt', p.completed_at,
                 'masteredDirectly', p.mastered_directly,
                 'checked', coalesce((
                   select jsonb_agg(ci.key order by ci.position, ci.id)
                   from app.checklist_progress cp
                   join app.checklist_items ci on ci.id = cp.checklist_item_id
                   where cp.user_id = p_uid and ci.topic_id = t.id
                 ), '[]'::jsonb),
                 'reviews', coalesce((
                   select jsonb_agg(
                            jsonb_build_object(
                              'intervalDays', r.interval_days, 'dueOn', r.due_on, 'completedAt', r.completed_at)
                            order by r.interval_days, r.id)
                   from app.reviews r
                   where r.user_id = p_uid and r.topic_id = t.id
                 ), '[]'::jsonb))
               order by t.id)
      from app.topic_progress p
      join app.topics t on t.id = p.topic_id
      where p.user_id = p_uid
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'slug', pj.slug,
                 'repositoryUrl', pp.repository_url,
                 'deployUrl', pp.deploy_url,
                 'milestones', coalesce((
                   select jsonb_agg(
                            jsonb_build_object('key', m.key, 'status', mp.status, 'completedAt', mp.completed_at)
                            order by m.position, m.id)
                   from app.milestone_progress mp
                   join app.milestones m on m.id = mp.milestone_id
                   where mp.user_id = p_uid and m.project_id = pj.id
                 ), '[]'::jsonb))
               order by pj.id)
      from app.projects pj
      left join app.project_progress pp on pp.project_id = pj.id and pp.user_id = p_uid
      where pp.project_id is not null
         or exists (
           select 1 from app.milestone_progress mp
           join app.milestones m on m.id = mp.milestone_id
           where mp.user_id = p_uid and m.project_id = pj.id)
    ), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'studiedOn', s.studied_on,
                 'durationMinutes', s.duration_minutes,
                 'topicSlug', t.slug,
                 'note', s.note)
               order by s.id)
      from app.study_sessions s
      left join app.topics t on t.id = s.topic_id
      where s.user_id = p_uid
    ), '[]'::jsonb)
  );
end
$$;

-- Restaura o progresso a partir de um backup, SUBSTITUINDO o progresso atual (tudo ou nada).
create or replace function app.import_backup(p_uid uuid, p_backup jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_skipped jsonb := '[]'::jsonb;
  v_topics int := 0;
  v_items int := 0;
  v_reviews int := 0;
  v_projects int := 0;
  v_milestones int := 0;
  v_sessions int := 0;
  v_topic_id bigint;
  v_item_id bigint;
  v_project_id bigint;
  v_milestone_id bigint;
  v_row jsonb;
  v_child jsonb;
  v_checked_at timestamptz;
  v_timezone text;
  v_goal int;
begin
  if jsonb_typeof(p_backup) is distinct from 'object' or (p_backup ->> 'version') is distinct from '1' then
    perform app.fail(422, 'validation_failed', 'Arquivo de backup inválido (versão 1 esperada).');
  end if;
  if jsonb_typeof(coalesce(p_backup -> 'topics', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_backup -> 'projects', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_backup -> 'sessions', '[]'::jsonb)) <> 'array' then
    perform app.fail(422, 'validation_failed', 'Arquivo de backup inválido.');
  end if;

  begin
    delete from app.reviews where user_id = p_uid;
    delete from app.checklist_progress where user_id = p_uid;
    delete from app.topic_progress where user_id = p_uid;
    delete from app.milestone_progress where user_id = p_uid;
    delete from app.project_progress where user_id = p_uid;
    delete from app.study_sessions where user_id = p_uid;

    for v_row in select * from jsonb_array_elements(coalesce(p_backup -> 'topics', '[]'::jsonb)) loop
      select t.id into v_topic_id from app.topics t where t.slug = v_row ->> 'slug';
      if v_topic_id is null then
        v_skipped := v_skipped || to_jsonb('tópico "' || coalesce(v_row ->> 'slug', '?') || '"');
        continue;
      end if;

      insert into app.topic_progress
        (user_id, topic_id, status, notes, evidence_url, started_at, completed_at, mastered_directly, updated_at)
      values (
        p_uid, v_topic_id,
        v_row ->> 'status',
        coalesce(v_row ->> 'notes', ''),
        nullif(v_row ->> 'evidenceUrl', ''),
        (v_row ->> 'startedAt')::timestamptz,
        (v_row ->> 'completedAt')::timestamptz,
        coalesce((v_row ->> 'masteredDirectly')::boolean, false),
        app.now());
      v_topics := v_topics + 1;

      v_checked_at := coalesce((v_row ->> 'completedAt')::timestamptz, (v_row ->> 'startedAt')::timestamptz,
                               (p_backup ->> 'exportedAt')::timestamptz, app.now());
      for v_child in select * from jsonb_array_elements(coalesce(v_row -> 'checked', '[]'::jsonb)) loop
        select ci.id into v_item_id
          from app.checklist_items ci
         where ci.topic_id = v_topic_id and ci.key = (v_child #>> '{}');
        if v_item_id is null then
          v_skipped := v_skipped || to_jsonb('item "' || (v_child #>> '{}') || '" do tópico "' || (v_row ->> 'slug') || '"');
          continue;
        end if;
        insert into app.checklist_progress (user_id, checklist_item_id, checked_at)
        values (p_uid, v_item_id, v_checked_at)
        on conflict do nothing;
        v_items := v_items + 1;
      end loop;

      for v_child in select * from jsonb_array_elements(coalesce(v_row -> 'reviews', '[]'::jsonb)) loop
        insert into app.reviews (user_id, topic_id, interval_days, due_on, completed_at)
        values (
          p_uid, v_topic_id,
          (v_child ->> 'intervalDays')::int,
          (v_child ->> 'dueOn')::date,
          (v_child ->> 'completedAt')::timestamptz);
        v_reviews := v_reviews + 1;
      end loop;
    end loop;

    for v_row in select * from jsonb_array_elements(coalesce(p_backup -> 'projects', '[]'::jsonb)) loop
      select pj.id into v_project_id from app.projects pj where pj.slug = v_row ->> 'slug';
      if v_project_id is null then
        v_skipped := v_skipped || to_jsonb('projeto "' || coalesce(v_row ->> 'slug', '?') || '"');
        continue;
      end if;

      insert into app.project_progress (user_id, project_id, repository_url, deploy_url, updated_at)
      values (
        p_uid, v_project_id,
        nullif(v_row ->> 'repositoryUrl', ''),
        nullif(v_row ->> 'deployUrl', ''),
        app.now());
      v_projects := v_projects + 1;

      for v_child in select * from jsonb_array_elements(coalesce(v_row -> 'milestones', '[]'::jsonb)) loop
        select m.id into v_milestone_id
          from app.milestones m
         where m.project_id = v_project_id and m.key = v_child ->> 'key';
        if v_milestone_id is null then
          v_skipped := v_skipped || to_jsonb('etapa "' || coalesce(v_child ->> 'key', '?') || '" do projeto "' || (v_row ->> 'slug') || '"');
          continue;
        end if;
        insert into app.milestone_progress (user_id, milestone_id, status, completed_at)
        values (p_uid, v_milestone_id, v_child ->> 'status', (v_child ->> 'completedAt')::timestamptz);
        v_milestones := v_milestones + 1;
      end loop;
    end loop;

    for v_row in select * from jsonb_array_elements(coalesce(p_backup -> 'sessions', '[]'::jsonb)) loop
      v_topic_id := null;
      if nullif(v_row ->> 'topicSlug', '') is not null then
        select t.id into v_topic_id from app.topics t where t.slug = v_row ->> 'topicSlug';
        if v_topic_id is null then
          v_skipped := v_skipped || to_jsonb('tópico "' || (v_row ->> 'topicSlug') || '" de uma sessão (mantida sem tópico)');
        end if;
      end if;
      insert into app.study_sessions (user_id, studied_on, duration_minutes, topic_id, note)
      values (
        p_uid,
        (v_row ->> 'studiedOn')::date,
        (v_row ->> 'durationMinutes')::int,
        v_topic_id,
        coalesce(v_row ->> 'note', ''));
      v_sessions := v_sessions + 1;
    end loop;

    if jsonb_typeof(p_backup -> 'settings') = 'object' then
      v_timezone := p_backup -> 'settings' ->> 'timezone';
      v_goal := app.parse_int(p_backup -> 'settings' -> 'weeklyGoal', 1, 50);
      insert into app.user_settings (user_id, timezone, weekly_goal)
      values (
        p_uid,
        case when app.is_valid_timezone(v_timezone) then v_timezone else app.user_timezone(p_uid) end,
        coalesce(v_goal, app.user_weekly_goal(p_uid)))
      on conflict (user_id) do update
        set timezone = excluded.timezone, weekly_goal = excluded.weekly_goal;
    end if;
  exception when others then
    if sqlstate like 'PT%' then
      raise;
    end if;
    perform app.fail(422, 'validation_failed', 'Backup inválido: ' || sqlerrm);
  end;

  return jsonb_build_object(
    'imported', jsonb_build_object(
      'topics', v_topics,
      'checklistItems', v_items,
      'reviews', v_reviews,
      'projects', v_projects,
      'milestones', v_milestones,
      'sessions', v_sessions),
    'skipped', v_skipped
  );
end
$$;
