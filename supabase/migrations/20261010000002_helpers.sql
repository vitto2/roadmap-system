-- Trilha Sênior — funções auxiliares e regras de pontuação "puras" (sem acesso a tabelas de progresso).
-- Todas ficam no esquema "app" (interno). As funções da API (esquema "public") estão nas migrations seguintes.

-- "Agora". Nos testes pode ser fixado com: select set_config('app.now', '2026-03-10T15:00:00Z', true);
create or replace function app.now()
returns timestamptz
language sql stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('app.now', true), '')::timestamptz, now())
$$;

-- Erros padronizados. O PostgREST converte SQLSTATE "PTnnn" no status HTTP nnn e repassa message/detail/hint:
--   { message, code: 'PT409', hint: '<código de máquina>', details: '<json dos erros por campo>' }
create or replace function app.fail(p_status int, p_code text, p_message text, p_details jsonb default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_details is null then
    raise exception '%', p_message using errcode = 'PT' || p_status::text, hint = p_code;
  else
    raise exception '%', p_message using errcode = 'PT' || p_status::text, hint = p_code, detail = p_details::text;
  end if;
end
$$;

create or replace function app.not_found(p_what text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform app.fail(404, 'not_found', p_what || ' não encontrado(a).');
end
$$;

-- Usuário autenticado (Supabase Auth); falha com 401 se não houver.
create or replace function app.uid()
returns uuid
language plpgsql stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    perform app.fail(401, 'unauthenticated', 'Autenticação necessária.');
  end if;
  return v_uid;
end
$$;

-- ───────────── Regras de pontuação ─────────────

create or replace function app.career_rank(p_level text)
returns int
language sql immutable
set search_path = ''
as $$
  select case p_level when 'beginner' then 0 when 'junior' then 1 when 'mid' then 2 when 'senior' then 3 end
$$;

-- Tópico concluído: dificuldade x 10 (10, 20, 30, 40, 50).
create or replace function app.topic_xp(p_difficulty int)
returns int
language sql immutable
set search_path = ''
as $$
  select p_difficulty * 10
$$;

-- Revisão concluída: 25% do XP do tópico (arredondado).
create or replace function app.review_xp(p_difficulty int)
returns int
language sql immutable
set search_path = ''
as $$
  select round(p_difficulty * 10 * 0.25)::int
$$;

-- XP necessário para completar o nível N: 100 x N^1,5.
create or replace function app.xp_to_complete_level(p_level int)
returns int
language sql immutable
set search_path = ''
as $$
  select round(100 * power(p_level::numeric, 1.5))::int
$$;

-- Nível de gamificação a partir do XP total (começa no nível 1; custos cumulativos).
create or replace function app.level_info(p_xp int)
returns jsonb
language plpgsql immutable
set search_path = ''
as $$
declare
  v_level int := 1;
  v_remaining int := greatest(0, p_xp);
  v_need int;
begin
  loop
    v_need := app.xp_to_complete_level(v_level);
    exit when v_remaining < v_need;
    v_remaining := v_remaining - v_need;
    v_level := v_level + 1;
  end loop;

  return jsonb_build_object(
    'level', v_level,
    'xpIntoLevel', v_remaining,
    'xpForNextLevel', v_need,
    'progressPercent', (v_remaining * 100) / v_need
  );
end
$$;

-- Projeto finalizado: 100 XP (+50 com repositório, +50 com deploy). Zero se não finalizado.
create or replace function app.project_bonus_total(p_finished boolean, p_has_repository boolean, p_has_deploy boolean)
returns int
language sql immutable
set search_path = ''
as $$
  select case when p_finished
    then 100 + (case when p_has_repository then 50 else 0 end) + (case when p_has_deploy then 50 else 0 end)
    else 0
  end
$$;

create or replace function app.project_bonus(p_finished boolean, p_has_repository boolean, p_has_deploy boolean)
returns jsonb
language sql immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'finished', p_finished,
    'finishXp', case when p_finished then 100 else 0 end,
    'repositoryXp', case when p_finished and p_has_repository then 50 else 0 end,
    'deployXp', case when p_finished and p_has_deploy then 50 else 0 end,
    'total', app.project_bonus_total(p_finished, p_has_repository, p_has_deploy)
  )
$$;

-- ───────────── Fuso horário e configurações do usuário ─────────────

create or replace function app.is_valid_timezone(p_timezone text)
returns boolean
language plpgsql stable
set search_path = ''
as $$
begin
  if p_timezone is null or p_timezone = '' then
    return false;
  end if;
  perform now() at time zone p_timezone;
  return true;
exception when others then
  return false;
end
$$;

create or replace function app.user_timezone(p_uid uuid)
returns text
language sql stable
set search_path = ''
as $$
  select coalesce((select s.timezone from app.user_settings s where s.user_id = p_uid), 'America/Sao_Paulo')
$$;

create or replace function app.user_weekly_goal(p_uid uuid)
returns int
language sql stable
set search_path = ''
as $$
  select coalesce((select s.weekly_goal from app.user_settings s where s.user_id = p_uid), 5)
$$;

-- Data de hoje (YYYY-MM-DD) no fuso do usuário. Datas ficam em UTC (timestamptz); só "dias" usam o fuso.
create or replace function app.today(p_uid uuid)
returns date
language sql stable
set search_path = ''
as $$
  select (app.now() at time zone app.user_timezone(p_uid))::date
$$;

-- ───────────── Permissões da API ─────────────
-- Funções do esquema public viram endpoints RPC. Por padrão o Supabase dá EXECUTE a anon/authenticated em
-- tudo que é criado lá; aqui fechamos para anon e liberamos só para usuários logados.
-- Chame no fim de qualquer migration que crie funções em public. Use um projeto Supabase dedicado a este app.
create or replace function app.lock_down_api()
returns void
language plpgsql
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_catalog.pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind = 'f'
      and p.proowner = (select o.oid from pg_catalog.pg_roles o where o.rolname = current_user)
      and not exists (select 1 from pg_catalog.pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke all on function %s from public, anon', r.signature);
    execute format('grant execute on function %s to authenticated', r.signature);
  end loop;
end
$$;
