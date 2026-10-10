-- Trilha Sênior — API pública (funções RPC no esquema "public").
--
-- O front-end chama estas funções com supabase.rpc('nome', { p_param: valor }). Todas:
--   * rodam com os privilégios de quem chama (SECURITY INVOKER) — a RLS das tabelas vale;
--   * exigem usuário logado (anon não tem EXECUTE — ver app.lock_down_api no fim);
--   * devolvem JSON no formato dos contratos do front (camelCase). Mutações devolvem { data, profile }.
-- Erros: SQLSTATE PTnnn => HTTP nnn (404 não encontrado, 409 conflito, 422 validação, 401 sem login).

-- ───────────── Perfil e configurações ─────────────

create or replace function public.get_profile()
returns jsonb
language sql stable
set search_path = ''
as $$
  select app.profile(app.uid())
$$;

create or replace function public.get_dashboard()
returns jsonb
language sql stable
set search_path = ''
as $$
  select app.dashboard(app.uid())
$$;

create or replace function public.get_settings()
returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'timezone', app.user_timezone(app.uid()),
    'weeklyGoal', app.user_weekly_goal(app.uid()))
$$;

create or replace function public.update_settings(p_patch jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := app.uid();
  v_errors jsonb := '{}'::jsonb;
  v_timezone text := app.user_timezone(v_uid);
  v_goal int := app.user_weekly_goal(v_uid);
  v_value int;
begin
  if jsonb_typeof(p_patch) is distinct from 'object' then
    perform app.fail(422, 'validation_failed', 'Os dados enviados são inválidos.',
                     jsonb_build_object('request', jsonb_build_array('Envie um objeto JSON.')));
  end if;

  if p_patch ? 'timezone' then
    if jsonb_typeof(p_patch -> 'timezone') = 'string' and app.is_valid_timezone(p_patch ->> 'timezone') then
      v_timezone := p_patch ->> 'timezone';
    else
      v_errors := app.add_error(v_errors, 'timezone',
        'Fuso horário inválido (use um nome IANA, ex.: America/Sao_Paulo).');
    end if;
  end if;

  if p_patch ? 'weeklyGoal' then
    v_value := app.parse_int(p_patch -> 'weeklyGoal', 1, 50);
    if v_value is null then
      v_errors := app.add_error(v_errors, 'weeklyGoal', 'A meta semanal deve ser um inteiro de 1 a 50.');
    else
      v_goal := v_value;
    end if;
  end if;

  perform app.raise_validation(v_errors);

  insert into app.user_settings (user_id, timezone, weekly_goal)
  values (v_uid, v_timezone, v_goal)
  on conflict (user_id) do update
    set timezone = excluded.timezone, weekly_goal = excluded.weekly_goal;

  return jsonb_build_object('timezone', v_timezone, 'weeklyGoal', v_goal);
end
$$;

-- ───────────── Trilhas e tópicos ─────────────

create or replace function public.list_tracks()
returns jsonb
language sql stable
set search_path = ''
as $$
  select app.track_summaries(app.uid())
$$;

create or replace function public.list_topics(
  p_track text default null,
  p_level text default null,
  p_status text default null
)
returns jsonb
language plpgsql stable
set search_path = ''
as $$
declare
  v_uid uuid := app.uid();
  v_errors jsonb := '{}'::jsonb;
begin
  if p_level is not null and p_level not in ('beginner', 'junior', 'mid', 'senior') then
    v_errors := app.add_error(v_errors, 'level', 'Nível inválido.');
  end if;
  if p_status is not null and p_status not in ('not_started', 'studying', 'completed') then
    v_errors := app.add_error(v_errors, 'status', 'Status inválido.');
  end if;
  perform app.raise_validation(v_errors);

  return coalesce((
    select jsonb_agg(s.summary order by s.track_position, s.pos)
    from app.topic_summaries(v_uid) s
    where (p_track is null or s.track_slug = p_track)
      and (p_level is null or s.career_level = p_level)
      and (p_status is null or s.status = p_status)
  ), '[]'::jsonb);
end
$$;

create or replace function public.get_topic(p_slug text)
returns jsonb
language sql stable
set search_path = ''
as $$
  select app.topic_detail(app.uid(), p_slug)
$$;

-- Marca/desmarca um item do checklist. Desmarcar item de tópico concluído reabre o tópico (desfaz o XP).
create or replace function public.set_checklist_item(p_slug text, p_key text, p_checked boolean)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := app.uid();
  v_topic_id bigint := app.find_topic(p_slug);
  v_item_id bigint;
  v_progress app.topic_progress;
begin
  if p_checked is null then
    perform app.fail(422, 'validation_failed', 'Informe se o item está marcado.',
                     jsonb_build_object('checked', jsonb_build_array('Informe true ou false.')));
  end if;

  select ci.id into v_item_id
    from app.checklist_items ci
   where ci.topic_id = v_topic_id and ci.key = p_key and ci.archived_at is null;
  if v_item_id is null then
    perform app.not_found('Item do checklist');
  end if;

  v_progress := app.ensure_progress(v_uid, v_topic_id);

  if p_checked then
    insert into app.checklist_progress (user_id, checklist_item_id, checked_at)
    values (v_uid, v_item_id, app.now())
    on conflict (user_id, checklist_item_id) do nothing;

    if v_progress.status = 'not_started' then
      update app.topic_progress
         set status = 'studying', started_at = coalesce(started_at, app.now()), updated_at = app.now()
       where user_id = v_uid and topic_id = v_topic_id;
    end if;
  else
    delete from app.checklist_progress where user_id = v_uid and checklist_item_id = v_item_id;
    if v_progress.status = 'completed' then
      perform app.reopen_topic(v_uid, v_topic_id);
    end if;
  end if;

  return app.mutation(v_uid, app.topic_detail(v_uid, p_slug));
end
$$;

-- Concluir exige o checklist completo (409 checklist_incomplete). Idempotente.
create or replace function public.complete_topic(p_slug text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := app.uid();
  v_topic_id bigint := app.find_topic(p_slug);
  v_progress app.topic_progress := app.ensure_progress(v_uid, v_topic_id);
begin
  if v_progress.status <> 'completed' then
    if exists (
      select 1
      from app.checklist_items ci
      left join app.checklist_progress cp on cp.checklist_item_id = ci.id and cp.user_id = v_uid
      where ci.topic_id = v_topic_id and ci.archived_at is null and cp.checklist_item_id is null
    ) then
      perform app.fail(409, 'checklist_incomplete',
                       'Marque todos os itens do checklist antes de concluir o tópico.');
    end if;
    perform app.finish_topic(v_uid, v_topic_id, false);
  end if;

  return app.mutation(v_uid, app.topic_detail(v_uid, p_slug));
end
$$;

-- "Já domino": marca o checklist inteiro e conclui de uma vez; agenda apenas a revisão de 90 dias.
create or replace function public.master_topic(p_slug text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := app.uid();
  v_topic_id bigint := app.find_topic(p_slug);
  v_progress app.topic_progress := app.ensure_progress(v_uid, v_topic_id);
begin
  if v_progress.status <> 'completed' then
    insert into app.checklist_progress (user_id, checklist_item_id, checked_at)
    select v_uid, ci.id, app.now()
      from app.checklist_items ci
     where ci.topic_id = v_topic_id and ci.archived_at is null
    on conflict (user_id, checklist_item_id) do nothing;

    perform app.finish_topic(v_uid, v_topic_id, true);
  end if;

  return app.mutation(v_uid, app.topic_detail(v_uid, p_slug));
end
$$;

create or replace function public.reopen_topic(p_slug text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := app.uid();
  v_topic_id bigint := app.find_topic(p_slug);
  v_progress app.topic_progress := app.ensure_progress(v_uid, v_topic_id);
begin
  if v_progress.status = 'completed' then
    perform app.reopen_topic(v_uid, v_topic_id);
  end if;

  return app.mutation(v_uid, app.topic_detail(v_uid, p_slug));
end
$$;

-- Atualiza status (não iniciado/estudando), notas e link de evidência. Só as chaves enviadas mudam.
create or replace function public.update_topic_progress(p_slug text, p_patch jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := app.uid();
  v_topic_id bigint := app.find_topic(p_slug);
  v_errors jsonb := '{}'::jsonb;
  v_progress app.topic_progress;
  v_status text;
  v_notes text;
  v_evidence record;
begin
  if jsonb_typeof(p_patch) is distinct from 'object' then
    perform app.fail(422, 'validation_failed', 'Os dados enviados são inválidos.',
                     jsonb_build_object('request', jsonb_build_array('Envie um objeto JSON.')));
  end if;

  if p_patch ? 'status' then
    if jsonb_typeof(p_patch -> 'status') = 'string' and (p_patch ->> 'status') in ('not_started', 'studying') then
      v_status := p_patch ->> 'status';
    else
      v_errors := app.add_error(v_errors, 'status',
        'Status inválido. Para concluir um tópico use a ação de concluir.');
    end if;
  end if;

  if p_patch ? 'notes' then
    if jsonb_typeof(p_patch -> 'notes') = 'string' and char_length(p_patch ->> 'notes') <= 20000 then
      v_notes := p_patch ->> 'notes';
    else
      v_errors := app.add_error(v_errors, 'notes', 'As notas devem ter até 20.000 caracteres.');
    end if;
  end if;

  if p_patch ? 'evidenceUrl' then
    select * into v_evidence from app.normalize_url(p_patch -> 'evidenceUrl', 'evidenceUrl', v_errors);
    v_errors := v_evidence.p_errors;
  end if;

  perform app.raise_validation(v_errors);

  v_progress := app.ensure_progress(v_uid, v_topic_id);

  if v_status is not null then
    if v_progress.status = 'completed' then
      perform app.reopen_topic(v_uid, v_topic_id);
    end if;
    update app.topic_progress
       set status = v_status,
           started_at = case v_status when 'studying' then coalesce(started_at, app.now()) else null end,
           updated_at = app.now()
     where user_id = v_uid and topic_id = v_topic_id;
  end if;

  if p_patch ? 'notes' then
    update app.topic_progress
       set notes = v_notes, updated_at = app.now()
     where user_id = v_uid and topic_id = v_topic_id;
  end if;

  if p_patch ? 'evidenceUrl' then
    update app.topic_progress
       set evidence_url = v_evidence.p_url, updated_at = app.now()
     where user_id = v_uid and topic_id = v_topic_id;
  end if;

  return app.mutation(v_uid, app.topic_detail(v_uid, p_slug));
end
$$;

-- ───────────── Projetos ─────────────

create or replace function public.list_projects()
returns jsonb
language sql stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(s.summary order by s.pos), '[]'::jsonb)
  from app.project_summaries(app.uid()) s
$$;

create or replace function public.get_project(p_slug text)
returns jsonb
language sql stable
set search_path = ''
as $$
  select app.project_detail(app.uid(), p_slug)
$$;

create or replace function public.set_milestone_status(p_slug text, p_key text, p_status text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := app.uid();
  v_project_id bigint;
  v_milestone_id bigint;
begin
  if p_status is null or p_status not in ('pending', 'in_progress', 'completed') then
    perform app.fail(422, 'validation_failed', 'Status da etapa inválido.',
                     jsonb_build_object('status', jsonb_build_array('Status da etapa inválido.')));
  end if;

  select p.id into v_project_id from app.projects p where p.slug = p_slug and p.archived_at is null;
  if v_project_id is null then
    perform app.not_found('Projeto');
  end if;

  select m.id into v_milestone_id
    from app.milestones m
   where m.project_id = v_project_id and m.key = p_key and m.archived_at is null;
  if v_milestone_id is null then
    perform app.not_found('Etapa');
  end if;

  insert into app.milestone_progress (user_id, milestone_id, status, completed_at)
  values (v_uid, v_milestone_id, p_status, case when p_status = 'completed' then app.now() end)
  on conflict (user_id, milestone_id) do update
    set status = excluded.status, completed_at = excluded.completed_at;

  return app.mutation(v_uid, app.project_detail(v_uid, p_slug));
end
$$;

create or replace function public.update_project_links(p_slug text, p_patch jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := app.uid();
  v_project_id bigint;
  v_errors jsonb := '{}'::jsonb;
  v_repo record;
  v_deploy record;
begin
  if jsonb_typeof(p_patch) is distinct from 'object' then
    perform app.fail(422, 'validation_failed', 'Os dados enviados são inválidos.',
                     jsonb_build_object('request', jsonb_build_array('Envie um objeto JSON.')));
  end if;

  select p.id into v_project_id from app.projects p where p.slug = p_slug and p.archived_at is null;
  if v_project_id is null then
    perform app.not_found('Projeto');
  end if;

  if p_patch ? 'repositoryUrl' then
    select * into v_repo from app.normalize_url(p_patch -> 'repositoryUrl', 'repositoryUrl', v_errors);
    v_errors := v_repo.p_errors;
  end if;
  if p_patch ? 'deployUrl' then
    select * into v_deploy from app.normalize_url(p_patch -> 'deployUrl', 'deployUrl', v_errors);
    v_errors := v_deploy.p_errors;
  end if;
  perform app.raise_validation(v_errors);

  insert into app.project_progress (user_id, project_id)
  values (v_uid, v_project_id)
  on conflict (user_id, project_id) do nothing;

  if p_patch ? 'repositoryUrl' then
    update app.project_progress
       set repository_url = v_repo.p_url, updated_at = app.now()
     where user_id = v_uid and project_id = v_project_id;
  end if;
  if p_patch ? 'deployUrl' then
    update app.project_progress
       set deploy_url = v_deploy.p_url, updated_at = app.now()
     where user_id = v_uid and project_id = v_project_id;
  end if;

  return app.mutation(v_uid, app.project_detail(v_uid, p_slug));
end
$$;

-- ───────────── Revisões espaçadas ─────────────

create or replace function public.list_reviews(p_scope text default 'today')
returns jsonb
language plpgsql stable
set search_path = ''
as $$
begin
  if p_scope is null or p_scope not in ('today', 'upcoming', 'pending', 'completed', 'all') then
    perform app.fail(422, 'validation_failed', 'Período inválido.',
                     jsonb_build_object('scope', jsonb_build_array('Período inválido.')));
  end if;
  return app.review_list(app.uid(), p_scope);
end
$$;

-- Conclui uma revisão (idempotente): rende 25% do XP do tópico.
create or replace function public.complete_review(p_id bigint)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := app.uid();
begin
  update app.reviews
     set completed_at = coalesce(completed_at, app.now())
   where id = p_id and user_id = v_uid;
  if not found then
    perform app.not_found('Revisão');
  end if;
  return app.mutation(v_uid, app.review_json(v_uid, p_id));
end
$$;

create or replace function public.undo_review(p_id bigint)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := app.uid();
begin
  update app.reviews set completed_at = null where id = p_id and user_id = v_uid;
  if not found then
    perform app.not_found('Revisão');
  end if;
  return app.mutation(v_uid, app.review_json(v_uid, p_id));
end
$$;

-- ───────────── Diário de estudo ─────────────

create or replace function public.list_study_sessions(p_page int default 1, p_per_page int default 20)
returns jsonb
language plpgsql stable
set search_path = ''
as $$
declare
  v_uid uuid := app.uid();
  v_errors jsonb := '{}'::jsonb;
  v_total bigint;
begin
  if p_page is null or p_page < 1 then
    v_errors := app.add_error(v_errors, 'page', 'A página deve ser 1 ou maior.');
  end if;
  if p_per_page is null or p_per_page < 1 or p_per_page > 100 then
    v_errors := app.add_error(v_errors, 'perPage', 'Itens por página: de 1 a 100.');
  end if;
  perform app.raise_validation(v_errors);

  select count(*) into v_total from app.study_sessions s where s.user_id = v_uid;

  return jsonb_build_object(
    'data', coalesce((
      select jsonb_agg(app.session_json(v_uid, x.id) order by x.studied_on desc, x.id desc)
      from (
        select s.id, s.studied_on
        from app.study_sessions s
        where s.user_id = v_uid
        order by s.studied_on desc, s.id desc
        limit p_per_page offset (p_page - 1) * p_per_page
      ) x
    ), '[]'::jsonb),
    'meta', jsonb_build_object('page', p_page, 'perPage', p_per_page, 'total', v_total)
  );
end
$$;

create or replace function public.create_study_session(p_input jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := app.uid();
  v_values jsonb := app.validate_session_input(v_uid, p_input, app.today(v_uid));
  v_id bigint;
begin
  insert into app.study_sessions (user_id, studied_on, duration_minutes, topic_id, note)
  values (
    v_uid,
    (v_values ->> 'studiedOn')::date,
    (v_values ->> 'durationMinutes')::int,
    (v_values ->> 'topicId')::bigint,
    v_values ->> 'note')
  returning id into v_id;

  return app.mutation(v_uid, app.session_json(v_uid, v_id));
end
$$;

-- Edita uma sessão (substitui os campos: nota e tópico omitidos são limpos; data omitida é mantida).
create or replace function public.update_study_session(p_id bigint, p_input jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := app.uid();
  v_existing date;
  v_values jsonb;
begin
  select s.studied_on into v_existing from app.study_sessions s where s.id = p_id and s.user_id = v_uid;
  if v_existing is null then
    perform app.not_found('Sessão');
  end if;

  v_values := app.validate_session_input(v_uid, p_input, v_existing);

  update app.study_sessions
     set studied_on = (v_values ->> 'studiedOn')::date,
         duration_minutes = (v_values ->> 'durationMinutes')::int,
         topic_id = (v_values ->> 'topicId')::bigint,
         note = v_values ->> 'note'
   where id = p_id and user_id = v_uid;

  return app.mutation(v_uid, app.session_json(v_uid, p_id));
end
$$;

create or replace function public.delete_study_session(p_id bigint)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := app.uid();
begin
  delete from app.study_sessions where id = p_id and user_id = v_uid;
  if not found then
    perform app.not_found('Sessão');
  end if;
  return jsonb_build_object('profile', app.profile(v_uid));
end
$$;

-- ───────────── Grafo, backup e restauração ─────────────

create or replace function public.get_graph()
returns jsonb
language sql stable
set search_path = ''
as $$
  select app.graph(app.uid())
$$;

create or replace function public.export_backup()
returns jsonb
language sql stable
set search_path = ''
as $$
  select app.export_backup(app.uid())
$$;

-- Substitui TODO o progresso do usuário pelo conteúdo do backup (tudo ou nada).
create or replace function public.import_backup(p_backup jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := app.uid();
  v_summary jsonb := app.import_backup(app.uid(), p_backup);
begin
  return app.mutation(v_uid, v_summary);
end
$$;

-- Fecha a API para anon e libera para usuários logados (rode de novo ao criar funções novas em public).
select app.lock_down_api();
