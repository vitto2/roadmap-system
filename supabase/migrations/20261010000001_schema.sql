-- Trilha Sênior — esquema do banco (Supabase / PostgreSQL)
--
-- As tabelas ficam no esquema "app", que NÃO é exposto pela API REST do Supabase.
-- O front-end só chama funções RPC do esquema "public" (veja as migrations seguintes).
--
-- Conteúdo (trilhas, tópicos, projetos...) e progresso do usuário ficam em tabelas separadas, ligadas por id.
-- O conteúdo é carregado de content/*.json por app.sync_content (upsert pelo slug; o que sumir é arquivado).
-- O progresso tem user_id (Supabase Auth) e é protegido por RLS: cada usuário só enxerga o próprio.

create schema if not exists app;
comment on schema app is 'Trilha Sênior: tabelas e funções internas (esquema não exposto pela API REST).';

grant usage on schema app to authenticated;

-- ───────────── Conteúdo ─────────────

create table if not exists app.tracks (
  id          bigint generated always as identity primary key,
  slug        text not null unique,
  title       text not null,
  description text not null default '',
  position    int not null default 0,
  required    boolean not null default true,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists app.topics (
  id           bigint generated always as identity primary key,
  track_id     bigint not null references app.tracks (id),
  slug         text not null unique,
  title        text not null,
  description  text not null default '',
  career_level text not null check (career_level in ('beginner', 'junior', 'mid', 'senior')),
  difficulty   smallint not null check (difficulty between 1 and 5),
  position     int not null default 0,
  archived_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists topics_track_id_idx on app.topics (track_id);

create table if not exists app.topic_prerequisites (
  topic_id        bigint not null references app.topics (id),
  prerequisite_id bigint not null references app.topics (id),
  primary key (topic_id, prerequisite_id),
  check (topic_id <> prerequisite_id)
);
create index if not exists topic_prerequisites_prerequisite_idx on app.topic_prerequisites (prerequisite_id);

create table if not exists app.topic_resources (
  id       bigint generated always as identity primary key,
  topic_id bigint not null references app.topics (id),
  name     text not null,
  url      text,
  position int not null default 0
);
create index if not exists topic_resources_topic_idx on app.topic_resources (topic_id);

create table if not exists app.checklist_items (
  id          bigint generated always as identity primary key,
  topic_id    bigint not null references app.topics (id),
  key         text not null,
  text        text not null,
  position    int not null default 0,
  archived_at timestamptz,
  unique (topic_id, key)
);

create table if not exists app.projects (
  id           bigint generated always as identity primary key,
  slug         text not null unique,
  title        text not null,
  description  text not null default '',
  career_level text not null check (career_level in ('beginner', 'junior', 'mid', 'senior')),
  difficulty   smallint not null check (difficulty between 1 and 5),
  position     int not null default 0,
  archived_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists app.project_topics (
  project_id bigint not null references app.projects (id),
  topic_id   bigint not null references app.topics (id),
  primary key (project_id, topic_id)
);

create table if not exists app.milestones (
  id                  bigint generated always as identity primary key,
  project_id          bigint not null references app.projects (id),
  key                 text not null,
  title               text not null,
  acceptance_criteria jsonb not null default '[]'::jsonb,
  xp                  int not null check (xp > 0),
  position            int not null default 0,
  archived_at         timestamptz,
  unique (project_id, key)
);

-- ───────────── Progresso (por usuário) ─────────────
-- Conteúdo nunca é apagado (arquivado), então as chaves estrangeiras abaixo não usam cascade para o conteúdo.

create table if not exists app.topic_progress (
  user_id           uuid not null references auth.users (id) on delete cascade,
  topic_id          bigint not null references app.topics (id),
  status            text not null default 'not_started' check (status in ('not_started', 'studying', 'completed')),
  notes             text not null default '' check (char_length(notes) <= 20000),
  evidence_url      text check (evidence_url is null or (evidence_url ~* '^https?://' and char_length(evidence_url) <= 500)),
  started_at        timestamptz,
  completed_at      timestamptz,
  mastered_directly boolean not null default false,
  updated_at        timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create table if not exists app.checklist_progress (
  user_id           uuid not null references auth.users (id) on delete cascade,
  checklist_item_id bigint not null references app.checklist_items (id),
  checked_at        timestamptz not null,
  primary key (user_id, checklist_item_id)
);

create table if not exists app.project_progress (
  user_id        uuid not null references auth.users (id) on delete cascade,
  project_id     bigint not null references app.projects (id),
  repository_url text check (repository_url is null or (repository_url ~* '^https?://' and char_length(repository_url) <= 500)),
  deploy_url     text check (deploy_url is null or (deploy_url ~* '^https?://' and char_length(deploy_url) <= 500)),
  updated_at     timestamptz not null default now(),
  primary key (user_id, project_id)
);

create table if not exists app.milestone_progress (
  user_id      uuid not null references auth.users (id) on delete cascade,
  milestone_id bigint not null references app.milestones (id),
  status       text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  completed_at timestamptz,
  primary key (user_id, milestone_id)
);

create table if not exists app.reviews (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  topic_id      bigint not null references app.topics (id),
  interval_days int not null check (interval_days > 0),
  due_on        date not null,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists reviews_user_due_idx on app.reviews (user_id, due_on);

create table if not exists app.study_sessions (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  studied_on       date not null,
  duration_minutes int not null check (duration_minutes between 1 and 1440),
  topic_id         bigint references app.topics (id) on delete set null,
  note             text not null default '' check (char_length(note) <= 500),
  created_at       timestamptz not null default now()
);
create index if not exists study_sessions_user_day_idx on app.study_sessions (user_id, studied_on);

create table if not exists app.user_settings (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  timezone    text not null default 'America/Sao_Paulo',
  weekly_goal int not null default 5 check (weekly_goal between 1 and 50)
);

-- ───────────── Segurança: RLS + permissões ─────────────
-- Conteúdo: leitura para usuários logados; ninguém escreve pelo app (só o dono do banco, via app.sync_content).
-- Progresso: cada usuário lê/escreve apenas as próprias linhas.

do $$
declare
  t text;
begin
  foreach t in array array[
    'tracks', 'topics', 'topic_prerequisites', 'topic_resources', 'checklist_items',
    'projects', 'project_topics', 'milestones'
  ] loop
    execute format('alter table app.%I enable row level security', t);
    execute format('drop policy if exists "Leitura do conteudo" on app.%I', t);
    execute format('create policy "Leitura do conteudo" on app.%I for select to authenticated using (true)', t);
    execute format('revoke all on app.%I from anon, authenticated', t);
    execute format('grant select on app.%I to authenticated', t);
  end loop;

  foreach t in array array[
    'topic_progress', 'checklist_progress', 'project_progress', 'milestone_progress',
    'reviews', 'study_sessions', 'user_settings'
  ] loop
    execute format('alter table app.%I enable row level security', t);
    execute format('drop policy if exists "Apenas o proprio usuario" on app.%I', t);
    execute format(
      'create policy "Apenas o proprio usuario" on app.%I for all to authenticated '
      'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('revoke all on app.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on app.%I to authenticated', t);
  end loop;
end
$$;
