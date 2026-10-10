-- Trilha Sênior — carga idempotente do conteúdo (trilhas, tópicos, projetos).
--
-- app.sync_content(jsonb) é chamada pelo supabase/seed.sql (gerado a partir de content/*.json) ou por
-- `npm run db:seed` (em tools/). Roda como dono do banco (SQL Editor / conexão direta) e NÃO é exposta pela API.
--
-- Regras:
--   * upsert pelo slug estável (tracks/topics/projects) e pela key estável (checklist e etapas);
--   * o que sumir do JSON NÃO é apagado: recebe archived_at (o progresso associado é preservado);
--   * o que voltar ao JSON é desarquivado;
--   * pré-requisitos, recursos e tópicos relacionados são substituídos (são conteúdo, não progresso).

create or replace function app.sync_content(p_content jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_now timestamptz := app.now();
  v_tracks jsonb := coalesce(p_content -> 'tracks', '[]'::jsonb);
  v_topics jsonb := coalesce(p_content -> 'topics', '[]'::jsonb);
  v_projects jsonb := coalesce(p_content -> 'projects', '[]'::jsonb);
  v_missing text;
  v_n_tracks int;
  v_n_topics int;
  v_n_items int;
  v_n_projects int;
  v_n_milestones int;
  v_a_tracks int;
  v_a_topics int;
  v_a_items int;
  v_a_projects int;
  v_a_milestones int;
  v_archived_milestones int := 0;
  v_rows int;
begin
  if jsonb_typeof(v_tracks) <> 'array' or jsonb_typeof(v_topics) <> 'array' or jsonb_typeof(v_projects) <> 'array' then
    raise exception 'Conteúdo inválido: tracks, topics e projects devem ser listas.';
  end if;

  -- ── Trilhas ──
  insert into app.tracks (slug, title, description, position, required)
  select x.slug, x.title, coalesce(x.description, ''), coalesce(x.position, 0), coalesce(x.required, true)
  from jsonb_to_recordset(v_tracks) as x(slug text, title text, description text, position int, required boolean)
  on conflict (slug) do update
    set title = excluded.title,
        description = excluded.description,
        position = excluded.position,
        required = excluded.required,
        archived_at = null;
  get diagnostics v_n_tracks = row_count;

  update app.tracks
     set archived_at = v_now
   where archived_at is null
     and slug <> all (select x.slug from jsonb_to_recordset(v_tracks) as x(slug text));
  get diagnostics v_a_tracks = row_count;

  -- ── Tópicos ──
  select string_agg(x.slug || ' (trilha "' || coalesce(x.track, '') || '")', ', ')
    into v_missing
    from jsonb_to_recordset(v_topics) as x(slug text, track text)
   where not exists (select 1 from app.tracks tr where tr.slug = x.track);
  if v_missing is not null then
    raise exception 'Tópicos com trilha inexistente: %', v_missing;
  end if;

  insert into app.topics (track_id, slug, title, description, career_level, difficulty, position)
  select tr.id, x.slug, x.title, coalesce(x.description, ''), x.level, x.difficulty, coalesce(x.position, 0)
  from jsonb_to_recordset(v_topics)
         as x(track text, slug text, title text, description text, level text, difficulty int, position int)
  join app.tracks tr on tr.slug = x.track
  on conflict (slug) do update
    set track_id = excluded.track_id,
        title = excluded.title,
        description = excluded.description,
        career_level = excluded.career_level,
        difficulty = excluded.difficulty,
        position = excluded.position,
        archived_at = null;
  get diagnostics v_n_topics = row_count;

  update app.topics
     set archived_at = v_now
   where archived_at is null
     and slug <> all (select x.slug from jsonb_to_recordset(v_topics) as x(slug text));
  get diagnostics v_a_topics = row_count;

  -- ── Pré-requisitos ──
  select string_agg(x.slug || ' -> ' || p.slug, ', ')
    into v_missing
    from jsonb_to_recordset(v_topics) as x(slug text, prerequisites jsonb)
   cross join lateral jsonb_array_elements_text(coalesce(x.prerequisites, '[]'::jsonb)) as p(slug)
   where not exists (select 1 from app.topics t where t.slug = p.slug);
  if v_missing is not null then
    raise exception 'Pré-requisitos inexistentes: %', v_missing;
  end if;

  delete from app.topic_prerequisites tp
   using app.topics t
   where tp.topic_id = t.id
     and t.slug in (select x.slug from jsonb_to_recordset(v_topics) as x(slug text));

  insert into app.topic_prerequisites (topic_id, prerequisite_id)
  select distinct t.id, pre.id
  from jsonb_to_recordset(v_topics) as x(slug text, prerequisites jsonb)
  join app.topics t on t.slug = x.slug
  cross join lateral jsonb_array_elements_text(coalesce(x.prerequisites, '[]'::jsonb)) as p(slug)
  join app.topics pre on pre.slug = p.slug;

  -- ── Recursos ──
  delete from app.topic_resources r
   using app.topics t
   where r.topic_id = t.id
     and t.slug in (select x.slug from jsonb_to_recordset(v_topics) as x(slug text));

  insert into app.topic_resources (topic_id, name, url, position)
  select t.id, r.obj ->> 'name', nullif(r.obj ->> 'url', ''), (r.ord - 1)::int
  from jsonb_to_recordset(v_topics) as x(slug text, resources jsonb)
  join app.topics t on t.slug = x.slug
  cross join lateral jsonb_array_elements(coalesce(x.resources, '[]'::jsonb)) with ordinality as r(obj, ord);

  -- ── Checklist ("como sei que dominei") ──
  insert into app.checklist_items (topic_id, key, text, position)
  select t.id, c.obj ->> 'key', c.obj ->> 'text', (c.ord - 1)::int
  from jsonb_to_recordset(v_topics) as x(slug text, checklist jsonb)
  join app.topics t on t.slug = x.slug
  cross join lateral jsonb_array_elements(coalesce(x.checklist, '[]'::jsonb)) with ordinality as c(obj, ord)
  on conflict (topic_id, key) do update
    set text = excluded.text,
        position = excluded.position,
        archived_at = null;
  get diagnostics v_n_items = row_count;

  update app.checklist_items ci
     set archived_at = v_now
    from app.topics t
   where ci.topic_id = t.id
     and ci.archived_at is null
     and t.slug in (select x.slug from jsonb_to_recordset(v_topics) as x(slug text))
     and not exists (
       select 1
       from jsonb_to_recordset(v_topics) as x(slug text, checklist jsonb)
       cross join lateral jsonb_array_elements(coalesce(x.checklist, '[]'::jsonb)) as c(obj)
       where x.slug = t.slug and c.obj ->> 'key' = ci.key
     );
  get diagnostics v_a_items = row_count;

  -- ── Projetos ──
  insert into app.projects (slug, title, description, career_level, difficulty, position)
  select x.slug, x.title, coalesce(x.description, ''), x.level, x.difficulty, coalesce(x.position, 0)
  from jsonb_to_recordset(v_projects)
         as x(slug text, title text, description text, level text, difficulty int, position int)
  on conflict (slug) do update
    set title = excluded.title,
        description = excluded.description,
        career_level = excluded.career_level,
        difficulty = excluded.difficulty,
        position = excluded.position,
        archived_at = null;
  get diagnostics v_n_projects = row_count;

  update app.projects
     set archived_at = v_now
   where archived_at is null
     and slug <> all (select x.slug from jsonb_to_recordset(v_projects) as x(slug text));
  get diagnostics v_a_projects = row_count;

  select string_agg(x.slug || ' -> ' || p.slug, ', ')
    into v_missing
    from jsonb_to_recordset(v_projects) as x(slug text, topics jsonb)
   cross join lateral jsonb_array_elements_text(coalesce(x.topics, '[]'::jsonb)) as p(slug)
   where not exists (select 1 from app.topics t where t.slug = p.slug);
  if v_missing is not null then
    raise exception 'Projetos com tópicos inexistentes: %', v_missing;
  end if;

  delete from app.project_topics pt
   using app.projects p
   where pt.project_id = p.id
     and p.slug in (select x.slug from jsonb_to_recordset(v_projects) as x(slug text));

  insert into app.project_topics (project_id, topic_id)
  select distinct p.id, t.id
  from jsonb_to_recordset(v_projects) as x(slug text, topics jsonb)
  join app.projects p on p.slug = x.slug
  cross join lateral jsonb_array_elements_text(coalesce(x.topics, '[]'::jsonb)) as tp(slug)
  join app.topics t on t.slug = tp.slug;

  -- ── Etapas (milestones) ──
  insert into app.milestones (project_id, key, title, acceptance_criteria, xp, position)
  select p.id,
         m.obj ->> 'key',
         m.obj ->> 'title',
         coalesce(m.obj -> 'acceptanceCriteria', '[]'::jsonb),
         (m.obj ->> 'xp')::int,
         (m.ord - 1)::int
  from jsonb_to_recordset(v_projects) as x(slug text, milestones jsonb)
  join app.projects p on p.slug = x.slug
  cross join lateral jsonb_array_elements(coalesce(x.milestones, '[]'::jsonb)) with ordinality as m(obj, ord)
  on conflict (project_id, key) do update
    set title = excluded.title,
        acceptance_criteria = excluded.acceptance_criteria,
        xp = excluded.xp,
        position = excluded.position,
        archived_at = null;
  get diagnostics v_n_milestones = row_count;

  update app.milestones ms
     set archived_at = v_now
    from app.projects p
   where ms.project_id = p.id
     and ms.archived_at is null
     and p.slug in (select x.slug from jsonb_to_recordset(v_projects) as x(slug text))
     and not exists (
       select 1
       from jsonb_to_recordset(v_projects) as x(slug text, milestones jsonb)
       cross join lateral jsonb_array_elements(coalesce(x.milestones, '[]'::jsonb)) as m(obj)
       where x.slug = p.slug and m.obj ->> 'key' = ms.key
     );
  get diagnostics v_rows = row_count;
  v_archived_milestones := v_rows;
  v_a_milestones := v_archived_milestones;

  return jsonb_build_object(
    'tracks', v_n_tracks,
    'topics', v_n_topics,
    'checklistItems', v_n_items,
    'projects', v_n_projects,
    'milestones', v_n_milestones,
    'archived', jsonb_build_object(
      'tracks', v_a_tracks,
      'topics', v_a_topics,
      'checklistItems', v_a_items,
      'projects', v_a_projects,
      'milestones', v_a_milestones
    )
  );
end
$$;

-- Ninguém além do dono do banco executa a carga de conteúdo.
revoke all on function app.sync_content(jsonb) from public, anon, authenticated;
