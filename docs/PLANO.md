# Plano — Trilha Sênior (monorepo Laravel + Vue)

> **Atualização (implementação final):** o roadmap continua ensinando PHP/Laravel e Vue, mas o **app** foi
> construído em TypeScript de ponta a ponta, por decisão do dono do projeto (não precisa de PHP/Composer instalados).
> Equivalências usadas no lugar da stack Laravel descrita abaixo:
>
> | Plano original | Implementado |
> | --- | --- |
> | Laravel + Eloquent + migrations | Fastify 5 + Drizzle ORM + SQLite (`backend/drizzle/`) |
> | Form Requests / API Resources | Schemas Zod por rota e DTOs em `backend/src/dto.ts` |
> | Actions/Services | `backend/src/actions` e `backend/src/services` |
> | `app/Domain/Scoring` (Pest) | `backend/src/domain/scoring` (Vitest) |
> | Pint / Larastan | ESLint + Prettier + `tsc --noEmit` |
> | Sanctum (opcional) | Login opcional por senha (`AUTH_PASSWORD`) com token HMAC |
> | Scramble (OpenAPI) | `@fastify/swagger` + Scalar em `/api/docs` |
>
> Fases 1–4 concluídas. Veja o `README.md` (como rodar) e o `CLAUDE.md` (convenções e decisões). Decisões de domínio:
> nível de gamificação começa em 1 e custa `100 × N^1,5` XP por nível (cumulativo); nível de carreira = 40/60/80% dos
> tópicos das trilhas obrigatórias (Carreira é opcional); "projeto finalizado" = todas as etapas ativas concluídas.
> O conteúdo final tem 10 trilhas, 138 tópicos e 11 projetos; os rótulos de rota no front são em português
> (`/trilhas/:slug`, `/topicos/:slug`, `/projetos`, `/revisoes`, `/diario`, `/dashboard`, `/grafo`, `/configuracoes`, `/entrar`).

## Contexto
App pessoal (single-user) de roadmap gamificado para chegar a dev sênior. Diretório atual (`Documents/roadmap`) está vazio e não é repositório git. Esta rodada entrega **apenas o plano**; nada de código até aprovação.
Pedido adicional: commit/push automático em https://github.com/vitto2/roadmap-system.git — após aprovação, `git init`, `remote add origin`, branch `main`, e um commit Conventional Commits + `git push` ao final de cada etapa (autenticação via credenciais git já configuradas na máquina; nunca gravar token no repo). Primeiro push: confirmar se o remoto está vazio (senão, pergunto antes de qualquer force/merge).

## 1. Estrutura de pastas
```
roadmap-system/
├─ CLAUDE.md  README.md  .gitignore  .editorconfig
├─ .github/workflows/ci.yml            (fase 4)
├─ backend/
│  ├─ app/
│  │  ├─ Domain/Scoring/   XpCalculator, LevelCalculator, CareerLevelEvaluator, ReviewScheduler, StreakCalculator (classes puras)
│  │  ├─ Actions/          CompleteTopic, MasterTopic, ToggleChecklistItem, CompleteMilestone, CompleteReview, LogStudySession...
│  │  ├─ Services/         ProgressSummaryService, PrerequisiteService, SeedContentService
│  │  ├─ Models/           CareerLevel? (enum), Track, Topic, TopicResource, ChecklistItem, Project, Milestone, TopicProgress, ...
│  │  ├─ Enums/            CareerLevel, TopicStatus, MilestoneStatus
│  │  ├─ Http/Controllers/Api/V1/
│  │  ├─ Http/Requests/    Http/Resources/
│  │  └─ Exceptions/ (render JSON padronizado)
│  ├─ config/trilha.php    (timezone, weekly_goal, níveis de carreira e % mínimos)
│  ├─ database/{migrations,factories,seeders,seed-data/{tracks,topics/*.json,projects/*.json}}
│  ├─ routes/api.php  tests/{Unit,Feature}  pint.json  phpstan.neon (Larastan lvl 6)
├─ frontend/
│  ├─ src/
│  │  ├─ api/        client.ts (fetch wrapper), types.ts (espelha Resources), tracks.ts, topics.ts, projects.ts, ...
│  │  ├─ stores/     profile, roadmap, topic, projects, reviews, journal, ui(theme)
│  │  ├─ composables/ useAsync, useMarkdown (markdown-it+DOMPurify), useTheme, useDebouncedSave
│  │  ├─ components/ layout/, roadmap/, topic/, projects/, charts/, common/ (LoadingState, ErrorState, EmptyState)
│  │  ├─ pages/      (finas) · router/ · App.vue · main.ts
│  ├─ vite.config.ts (proxy /api → :8000), tailwind, eslint, prettier, vitest
```

## 2. Schema (migrations) — portável MySQL/PG/SQLite
Datas em UTC (`timestamp`/`date`); sem JSON-queries específicas, sem enums nativos (string + cast Enum).

**Conteúdo** (todos com `slug` único estável, `archived_at` nullable, `timestamps`):
- `tracks`: id, slug, title, description, position
- `topics`: id, track_id FK, slug, title, description, career_level(string), difficulty(tinyint 1-5), position, archived_at
- `topic_prerequisites`: topic_id, prerequisite_id (PK composta)
- `topic_resources`: id, topic_id, name, url nullable, position
- `topic_checklist_items`: id, topic_id, slug/key (estável por tópico), text, position, archived_at
- `projects`: id, slug, title, description, career_level, difficulty, position, archived_at
- `project_topic`: project_id, topic_id
- `milestones`: id, project_id, slug, title, acceptance_criteria(text), xp, position, archived_at

**Progresso** (ligado por id, nunca apagado pelo seed):
- `topic_progress`: id, topic_id unique, status(not_started|studying|completed), notes(text md), evidence_url, started_at, completed_at, mastered_directly(bool)
- `checklist_progress`: id, topic_id, checklist_item_id unique, checked_at
- `project_progress`: id, project_id unique, repository_url, deploy_url, completed_at
- `milestone_progress`: id, milestone_id unique, status, completed_at
- `reviews`: id, topic_id, interval_days(7|30|90), due_on(date), completed_at nullable
- `study_sessions`: id, studied_on(date local), duration_minutes, topic_id nullable, note
- `settings`: key/value (timezone, weekly_goal) — single-row-ish

**Idempotência do seed:** `upsert` por slug; itens ausentes do JSON recebem `archived_at = now()` (nunca delete/cascade); reaparecendo, são desarquivados. Checklist items usam `key` estável para preservar marcações.
**XP derivado:** calculado por query a partir de `topic_progress`(completed), `milestone_progress`, `project_progress` (bônus), `reviews` concluídas — sem coluna de contador. Desmarcar item/reabrir tópico remove o XP naturalmente (e cancela revisões pendentes do tópico).

## 3. Regras de domínio (app/Domain/Scoring, puras + Pest unit)
- Tópico: `difficulty × 10`; etapa: `milestone.xp`; projeto finalizado: 100 + 50 (repo) + 50 (deploy); revisão: `round(0.25 × xp_tópico)`.
- Nível gamificação N: XP acumulado ≥ `100 × N^1.5`; `LevelCalculator::forXp()` devolve nível, XP no nível, XP p/ próximo.
- Nível de carreira: `% mínimo` por nível sobre trilhas obrigatórias (config/trilha.php; proposta: Júnior 40%, Pleno 60%, Sênior 80% dos tópicos do nível e anteriores). Ver pergunta aberta abaixo.
- Concluir tópico exige checklist completo; `MasterTopic` (“Já domino”) marca tudo, conclui e agenda só a revisão de 90 dias; conclusão normal agenda 7/30/90.
- Streak/semana calculados no fuso configurável a partir de `study_sessions`; quebrar streak não altera XP.
- Pré-requisitos pendentes → campo `recommended_first` na API (não bloqueia).
- Front só exibe valores da API.

## 4. Endpoints `/api/v1`
| Método | Rota | Descrição |
|---|---|---|
| GET | /profile | XP total, nível gamif., nível carreira, progresso geral, streak, meta semanal |
| GET/PUT | /settings | timezone, meta semanal |
| GET | /tracks | trilhas com contagem/progresso |
| GET | /tracks/{slug} | trilha + tópicos |
| GET | /topics?track=&level=&status= | lista filtrada |
| GET | /topics/{slug} | detalhe (checklist, recursos, prereqs, progresso, `recommended_first`) |
| PATCH | /topics/{slug}/progress | status, notes, evidence_url |
| PUT | /topics/{slug}/checklist/{key} | marca/desmarca item `{checked}` |
| POST | /topics/{slug}/complete | conclui (valida checklist) |
| POST | /topics/{slug}/master | “Já domino” |
| POST | /topics/{slug}/reopen | desfaz conclusão |
| GET | /projects, /projects/{slug} | catálogo/detalhe |
| PATCH | /projects/{slug}/progress | repository_url, deploy_url |
| PUT | /projects/{slug}/milestones/{slug} | `{completed}` |
| GET | /reviews?due=today | fila do dia |
| POST | /reviews/{id}/complete | conclui revisão |
| GET/POST | /study-sessions | diário (lista paginada / cria) |
| PUT/DELETE | /study-sessions/{id} | edita/remove |
| GET | /dashboard | XP, radar por trilha, sessões por semana, streak |
| GET | /graph | nós/arestas de pré-requisitos (fase 4) |
| GET | /export/portfolio.md · /export/backup · POST /import/backup | fase 4 |
| POST | /auth/login · /auth/logout | Sanctum opcional (fase 4) |

Erro padrão: `{ "message", "code", "errors": {campo:[...]} }` (422/404/409/500) via handler de exceções.

## 5. Front-end
**Rotas/páginas:** `/` Roadmap · `/trilhas/:slug` · `/topicos/:slug` · `/projetos` · `/projetos/:slug` · `/revisoes` · `/diario` · `/dashboard` · `/grafo` (f4) · `/configuracoes` · 404.
**Stores Pinia:** `profile` (XP/nível/streak, refetch após ações), `roadmap` (trilhas, tópicos, filtros), `topic` (detalhe + ações), `projects`, `reviews`, `journal`, `ui` (tema claro/escuro, persistido).
Toda ação de mutação → chama API → recarrega `profile`. Estados loading/erro/vazio via componentes comuns. Tailwind `dark:` + foco visível + labels; mobile-first.

## 6. Trilhas e tópicos do seed (12–20 por trilha; nível/dificuldade `Nível·D`)
Iniciante=I, Júnior=J, Pleno=P, Sênior=S. Itens abaixo são os títulos; JSON completo (descrição, checklist de 3–6 itens, recursos oficiais sem URLs duvidosas) será gerado na Fase 1.

1. **Fundamentos** (14): Lógica de programação I·1 · Variáveis e tipos I·1 · Condicionais e laços I·1 · Funções I·2 · Terminal e shell I·2 · Git básico I·2 · Git avançado (rebase, bisect) J·3 · Arrays, listas e mapas J·2 · Recursão J·3 · Complexidade (Big-O) J·3 · Pilhas, filas e listas ligadas J·3 · Árvores e grafos P·4 · Ordenação e busca P·3 · Programação dinâmica e greedy S·5
2. **Web base** (14): HTML semântico I·1 · CSS básico e box model I·1 · Flexbox e Grid I·2 · JavaScript essencial I·2 · DOM e eventos I·2 · Assincronismo (Promises/async) J·3 · Fetch e HTTP J·2 · TypeScript básico J·3 · Acessibilidade (WCAG, ARIA) J·3 · TypeScript avançado (generics) P·4 · HTTP em profundidade (cache, CORS) P·3 · Performance web (Core Web Vitals) P·4 · Event loop e módulos P·4 · PWA e Service Workers S·4
3. **Front-end com Vue** (16): Vue 3 e SFC I·2 · Template e reatividade I·2 · Props e emits J·2 · Composition API e `<script setup>` J·3 · Computed e watch J·3 · Vue Router J·3 · Pinia J·3 · Vite e build J·2 · Composables J·3 · Formulários e validação J·3 · Slots e provide/inject P·4 · Testes com Vitest + Test Utils P·3 · Tailwind e design system P·3 · TypeScript com Vue P·4 · Performance (lazy, virtual list) S·4 · SSR/Nuxt e arquitetura de front S·5
4. **Back-end PHP e Laravel** (18): PHP moderno (8.x) I·2 · Composer e PSR I·2 · POO em PHP J·3 · Rotas e controllers J·2 · Migrations e Eloquent básico J·3 · Validação e Form Requests J·2 · API Resources J·3 · Relacionamentos Eloquent J·3 · Autenticação (Sanctum) P·3 · Autorização (Policies/Gates) P·3 · Testes com Pest P·3 · Filas e Jobs P·4 · Cache P·3 · Eventos e listeners P·3 · N+1 e otimização Eloquent P·4 · Actions/Services e arquitetura P·4 · Reverb e broadcasting S·4 · Laravel em produção (Horizon, Octane) S·5
5. **Banco de dados e SQL** (13): Modelo relacional I·2 · SELECT/JOIN I·2 · Agregações e GROUP BY J·2 · Modelagem e ER J·3 · Normalização J·3 · Índices J·3 · Transações e ACID P·4 · Isolamento e locks P·4 · EXPLAIN e otimização P·4 · Migrações seguras P·3 · Window functions e CTEs P·4 · NoSQL e Redis (quando usar) P·3 · Replicação, particionamento S·5
6. **Qualidade** (12): Testes unitários J·2 · Testes de integração J·3 · TDD J·3 · Clean code J·2 · Code review J·3 · Refatoração J·3 · Linters e análise estática J·2 · CI com GitHub Actions P·3 · CD e estratégias de release P·4 · Testes E2E P·3 · Cobertura e mutation testing S·4 · Dívida técnica S·4
7. **Arquitetura e System Design** (14): Princípios SOLID J·3 · Padrões de projeto (criacionais) P·3 · Padrões (estruturais/comportamentais) P·3 · Arquitetura em camadas P·3 · DDD básico P·4 · Hexagonal/Clean Architecture S·4 · Monólito modular S·4 · APIs REST maduras (versionamento, idempotência) P·4 · Filas e mensageria S·4 · Cache e CDN S·4 · Escalabilidade horizontal S·5 · CAP e consistência eventual S·5 · Microsserviços e trade-offs S·5 · ADRs e documentação de decisões S·3
8. **DevOps e Observabilidade** (13): Linux essencial J·2 · Redes básicas J·2 · Docker J·3 · Docker Compose J·3 · Deploy de apps PHP/Node P·3 · Nginx e proxy reverso P·3 · Logs estruturados P·3 · Métricas e alertas P·4 · Tracing distribuído S·4 · Infra como código S·4 · Kubernetes (noções) S·4 · SLI/SLO e incidentes S·4 · Backup e disaster recovery S·4
9. **Segurança** (12): Princípios (CIA, menor privilégio) J·2 · OWASP Top 10 J·3 · XSS e CSRF J·3 · SQL Injection J·3 · Hash de senhas e criptografia básica J·3 · Autenticação e sessões P·3 · OAuth2 e JWT P·4 · Autorização (RBAC/ABAC) P·3 · Gestão de segredos P·3 · Dependências vulneráveis P·2 · Threat modeling S·4 · Hardening e auditoria S·4
10. **Carreira e Soft Skills** (12): Comunicação escrita I·2 · Pedir ajuda e debugar em voz alta I·1 · Gestão de tempo e foco J·2 · Documentação técnica J·2 · Estimativas P·3 · Feedback (dar e receber) P·3 · Metodologias ágeis P·2 · Mentoria J·3→P · Priorização e negociação P·3 · Apresentações técnicas P·3 · Liderança técnica S·4 · Tomada de decisão e influência S·4

## 7. Projetos desafio (≥10, fase 2)
1 Encurtador de URL (J·2) · 2 To-do API + Vue (J·2) · 3 API REST com Sanctum e Pest (J·3) · 4 Blog com markdown e cache (P·3) · 5 Painel de métricas com Chart.js (P·3) · 6 Sistema de tarefas com filas e jobs (P·4) · 7 Chat em tempo real com Reverb/Echo + Vue (P·4) · 8 E-commerce modular (carrinho/pedido, DDD básico) (S·5) · 9 API com CI/CD, Docker e deploy (P·4) · 10 Observabilidade: logs, métricas e alertas (S·4) · 11 Rate limiter + cache distribuído (S·5). Cada um com 4–6 etapas (XP 15–60) e critérios de aceite.

## 8. Plano de fases (cada etapa → commit Conventional + push)
- **F0 Bootstrap:** git init/remote, `laravel new` em backend/, `npm create vue` em frontend/, Pint/Larastan/ESLint/Prettier/Tailwind, proxy Vite + CORS, `.env.example`, CLAUDE.md, README inicial.
- **F1 MVP:** migrations/models/enums/factories → Scoring + testes unit → seeders idempotentes + JSON (10 trilhas) → endpoints profile/tracks/topics/progress/checklist/master → testes feature → front: layout/topbar, roadmap, página do tópico, tema, estados.
- **F2 Projetos:** schema/seed de projetos+etapas, endpoints, bônus de XP, páginas.
- **F3 Revisão/Dashboard:** reviews (agendamento 7/30/90, “Já domino” = 90), fila do dia, study_sessions, streak/meta semanal, dashboard (radar + barras vue-chartjs), diário.
- **F4 Acabamento:** grafo Vue Flow, export portfólio md + backup/restore JSON, Sanctum opcional, Scramble (OpenAPI), CI GitHub Actions.

## 9. Como rodar (local)
```
# backend
cd backend && composer install && cp .env.example .env && php artisan key:generate
touch database/database.sqlite && php artisan migrate --seed && php artisan serve   # :8000
# frontend
cd frontend && npm install && npm run dev                                           # :5173 (proxy /api)
# qualidade
cd backend && ./vendor/bin/pest && ./vendor/bin/pint --test && ./vendor/bin/phpstan analyse
cd frontend && npm run lint && npm run type-check && npm run test
```

## 10. Verificação
Pest (scoring, níveis, revisões, pré-requisitos, seed idempotente preservando progresso + arquivando removidos, endpoints), Vitest (stores/composables), Pint/Larastan/ESLint/vue-tsc limpos, e smoke test manual no navegador (marcar checklist → concluir → XP/nível sobem; desmarcar → XP desfeito).

## Decisões assumidas (corrijo se discordar)
- Laravel = última estável no momento do `laravel new` (verifico via Composer); PHP ≥ 8.3.
- Nível de carreira: % mínimos 40/60/80 (Júnior/Pleno/Sênior) sobre tópicos do nível-alvo e anteriores; todas as 10 trilhas obrigatórias, exceto Carreira (opcional) — a definir.
- Meta semanal e timezone em tabela `settings` (editáveis na UI).
- Sem Docker/Sail obrigatório.

## Perguntas em aberto
1. Confirma os % mínimos por nível de carreira e quais trilhas são obrigatórias?
2. O repositório remoto está vazio? Posso criar `main` e fazer push direto a cada etapa?
