# Trilha Sênior — guia para o Claude Code

App pessoal de roadmap gamificado para estudar programação até o nível sênior. Interface em **português do Brasil**.
Roda **na web** (site estático) e guarda tudo no **Supabase** (Auth + Postgres). O **conteúdo** do roadmap ensina
PHP/Laravel e Vue (entre outras trilhas); o **app** em si é TypeScript (Vue 3) + SQL (Postgres) — decisão do dono do projeto.

Monorepo:

- `supabase/` — migrations SQL (esquema, RLS, regras de negócio como funções RPC), `seed.sql` gerado e `local/auth_stub.sql`
- `content/` — conteúdo do roadmap em JSON (trilhas, tópicos, projetos, pré-requisitos entre trilhas)
- `tools/` — validação do conteúdo, gerador do seed, aplicação no banco (`pg`) e **testes do SQL em PGlite**
- `frontend/` — SPA (Vue 3 `<script setup>`, TypeScript strict, Vite, Pinia, Vue Router, Tailwind v4, Chart.js, Vue Flow, Vitest)

## Comandos

```bash
# tools (cd tools)
npm install
npm test                         # SQL em PGlite: regras, RLS, permissões, contrato JSON, seed
npm run lint && npm run format:check && npm run typecheck
npm run content:validate         # formato/integridade do conteúdo
npm run content:build            # regenera supabase/seed.sql (use --check no CI)
npm run content:check-urls       # links dos recursos (rede)
npm run db:setup                 # migrations + seed no Supabase (DATABASE_URL em tools/.env)

# frontend (cd frontend)
npm install
npm run dev                      # usa .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
npm run dev:demo                 # SQL no navegador (PGlite), sem Supabase
npm test                         # stores, componentes, cliente supabase (mock) e API x SQL real (demo em memória)
npm run lint && npm run format:check && npm run type-check
npm run build                    # site estático em dist/
```

Antes de um commit: `npm run lint && npm run format:check && npm run typecheck && npm test` em `tools/` e
`npm run lint && npm run format:check && npm run type-check && npm test` em `frontend/`.

## Arquitetura

```
Vue SPA ──supabase-js──▶ Supabase Auth  (e-mail + senha)
                      └▶ PostgREST  ──▶ funções RPC public.* (SECURITY INVOKER) ──▶ tabelas app.* (RLS por usuário)
```

- **Regras no banco.** XP, nível, carreira, streak, revisões, grafo, backup e validações são funções SQL. O front **só exibe**
  (mutações devolvem `{ data, profile }` com o perfil já recalculado). Nunca recalcule XP no front-end.
- **Esquemas.** Tabelas e helpers em `app` (não exposto pela API REST); a API pública são as funções de `public`
  (`get_profile`, `get_topic`, `complete_topic`, `master_topic`, `set_milestone_status`, `import_backup`...).
  `app.lock_down_api()` (chamada no fim das migrations que criam funções em `public`) tira o EXECUTE de `anon`/PUBLIC e dá
  a `authenticated` — **chame-a em toda migration nova que crie função em `public`**; há teste que falha se esquecer.
- **Segurança.** RLS ligada em todas as tabelas de `app` (teste confere). Conteúdo: leitura para `authenticated`, ninguém escreve
  pelo app. Progresso: `user_id = auth.uid()`. Funções são `SECURITY INVOKER` com `set search_path = ''` (nomes qualificados).
- **Erros.** As funções levantam SQLSTATE `PTnnn` (nnn = status HTTP; o PostgREST repassa), com o código de máquina em
  `hint` (`not_found`, `checklist_incomplete`, `validation_failed`, `unauthenticated`) e os erros por campo (JSON) em `detail`.
  `frontend/src/lib/backend/errors.ts` (`toApiError`) converte isso em `ApiError`.
- **Conteúdo × progresso separados.** `app.sync_content(jsonb)` faz upsert pelo slug (tracks/topics/projects) e pela key
  (checklist/etapas); o que sumir do JSON recebe `archived_at` (nunca é apagado); o que voltar é desarquivado. O XP de itens
  arquivados continua contando; percentuais usam só itens ativos.
- **XP é derivado**, nunca um contador: tópicos concluídos + etapas concluídas + bônus de projeto + revisões concluídas.
- **Regras.** Tópico = dificuldade × 10; revisão = 25% do XP do tópico (arredondado); projeto finalizado (todas as etapas ativas
  concluídas) = 100 (+50 repositório, +50 deploy); nível N custa 100·N^1.5 XP (começa em 1, cumulativo). Carreira: 40/60/80% dos
  tópicos das trilhas **obrigatórias** até o nível; níveis sequenciais. "Já domino" agenda só a revisão de 90 dias.
  Reabrir (ou desmarcar item de tópico concluído) apaga as revisões do tópico.
- **Datas.** `timestamptz` em UTC; datas de calendário (`due_on`, `studied_on`) no fuso do usuário (`user_settings`, padrão
  `America/Sao_Paulo`). `app.now()` pode ser fixado nos testes com `set_config('app.now', ..., true)`.
- **Backend no front.** `frontend/src/lib/backend/` define a interface `Backend` (`rpc` + `auth`) com duas implementações:
  `supabase.ts` (produção) e `local.ts` (modo demo/testes: PGlite com o **mesmo** SQL). O build de produção troca `local.ts`
  por um stub (`vite.config.ts`) para não levar o PGlite (~16 MB); o CI confere.
- **Markdown** das notas sempre sanitizado (markdown-it com `html:false` + DOMPurify).

## Convenções

- Commits pequenos no padrão **Conventional Commits** (`feat:`, `fix:`, `docs:`, `test:`, `chore:`...), um por etapa lógica.
- TypeScript estrito; sem `any` (exceção apenas em `tools/tests/support/harness.ts`).
- Prettier: sem ponto-e-vírgula, aspas simples, largura 100. Rodar `npm run format` antes de commitar.
- Sem segredos no repositório: `.env` ignorado; `DATABASE_URL` só em `tools/.env`; `.env.example` sempre atualizado.
- **Mudou a API SQL** → atualize `frontend/src/api/index.ts` + `types.ts`, `tools/src/dto.ts` (contrato) e os testes
  (`tools/tests/db/*`, `frontend/src/api/__tests__/api.integration.spec.ts`).
- **Mudou o banco** → crie uma **nova** migration em `supabase/migrations/<timestamp>_<nome>.sql` (não edite as já aplicadas);
  testes em PGlite devem passar. Tabelas novas: RLS ligada + políticas + grants.
- Conteúdo: depois de editar `content/`, rode `npm run content:build` e commite `supabase/seed.sql` (o CI confere).

## Como adicionar conteúdo

- **Tópico**: objeto em `content/topics/<trilha>.json` (campos em `tools/src/content/schema.ts`: `slug` com prefixo da trilha,
  `level`, `difficulty` 1–5, `prerequisites`, `resources`, `checklist` de 3–6 itens com `key` estável). Rode
  `npm run content:validate`, `npm run content:build` e `npm run db:seed`. Não troque `slug`/`key` existentes.
- **Projeto**: `content/projects/*.json` (4–6 etapas, XP 15–60, critérios de aceite).
- **Pré-requisito entre trilhas**: `content/cross-prerequisites.json`.
- Links em `resources` só quando a URL existe (`npm run content:check-urls`); na dúvida, deixe apenas o nome.

## Ambiente

- Não há Docker nem Supabase CLI no fluxo: SQL é testado em PGlite e aplicado com `npm run db:setup` (pacote `pg`).
- Se o registro npm estiver indisponível, `npm install --offline` usa o cache local.
