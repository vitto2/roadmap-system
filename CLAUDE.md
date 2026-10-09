# Trilha Sênior — guia para o Claude Code

App pessoal (single-user) de roadmap gamificado para estudar programação até o nível sênior.
Interface em **português do Brasil**. O **conteúdo** do roadmap ensina PHP/Laravel e Vue (entre outras trilhas);
o **app** em si é feito em TypeScript (Node + Vue) — decisão do dono do projeto.

Monorepo com duas aplicações independentes:

- `backend/` — API REST (Node 22+, Fastify 5, Drizzle ORM + SQLite, Zod, Vitest)
- `frontend/` — SPA (Vue 3 `<script setup>`, TypeScript strict, Vite, Pinia, Vue Router, Tailwind v4, Chart.js, Vitest)

## Comandos

```bash
# Back-end (cd backend)
npm install
cp .env.example .env            # opcional: há padrões
npm run db:setup                # migrations + seed (idempotente)
npm run dev                     # API em http://127.0.0.1:8000
npm test                        # Vitest (domínio, seed e endpoints)
npm run lint && npm run format:check && npm run typecheck
npm run seed:validate           # valida formato/integridade do conteúdo
npm run seed:check-urls         # confere se os links dos recursos respondem (rede)
npm run db:generate             # gera migration após mudar src/db/schema.ts

# Front-end (cd frontend)
npm install
npm run dev                     # http://localhost:5173 (proxy /api -> 127.0.0.1:8000)
npm test                        # Vitest (stores, composables, componentes)
npm run lint && npm run format:check && npm run type-check
npm run build
```

Para verificar tudo antes de um commit: `npm run lint && npm run format:check && npm run typecheck && npm test` no back-end e
`npm run lint && npm run format:check && npm run type-check && npm test` no front-end.

## Arquitetura (back-end)

```
src/
  domain/scoring/   regras PURAS (sem HTTP/DB): XP, nível, carreira, revisão, streak, datas
  db/               schema Drizzle, client, migrations (pasta drizzle/)
  seed/             schema Zod dos JSONs, leitura/validação, loader idempotente
  actions/          mutações (uma por caso de uso), transacionais
  services/         leituras/montagem de DTOs (tópicos, projetos, perfil, XP...)
  http/             app Fastify, rotas finas, schemas de request/response
  dto.ts            contratos (API Resources) em Zod — o front espelha em src/api/types.ts
  errors.ts         AppError -> { message, code, errors? }
```

Decisões importantes:

- **Conteúdo × progresso separados.** Conteúdo vem de `backend/database/seed-data/*.json` (`tracks.json`, `topics/<trilha>.json`,
  `projects/*.json`, `cross-prerequisites.json`). O seed faz upsert pelo **slug estável**. O que sumir do JSON é **arquivado**
  (`archived_at`), nunca apagado; progresso fica em tabelas próprias ligadas por id.
- **XP é derivado**, nunca um contador: `services/xp.ts` soma tópicos concluídos, etapas, bônus de projeto e revisões.
  Desmarcar/reabrir remove o XP na próxima leitura. O front **só exibe** os valores (mutações devolvem `{ data, profile }`).
- Regras: tópico = dificuldade × 10; revisão = 25% do XP do tópico (arredondado); projeto finalizado = 100 (+50 repositório,
  +50 deploy), "finalizado" = todas as etapas ativas concluídas; nível N custa 100·N^1.5 XP (nível começa em 1, cumulativo).
- Nível de carreira: % mínimo (Júnior 40, Pleno 60, Sênior 80) dos tópicos das trilhas **obrigatórias** até aquele nível;
  níveis são sequenciais. Constantes em `domain/scoring/career.ts`.
- Concluir tópico exige checklist completo (409 `checklist_incomplete`). "Já domino" marca tudo e agenda **só** a revisão de 90 dias.
  Reabrir (ou desmarcar item de tópico concluído) apaga as revisões do tópico.
- Datas em UTC no banco (texto ISO). Datas de calendário (`due_on`, `studied_on`) são `YYYY-MM-DD` no fuso configurável
  (padrão `America/Sao_Paulo`, editável em `/configuracoes`). Streak/semana/revisões usam esse fuso.
- Schema portável (sem recursos exclusivos do SQLite): sem enums nativos, sem JSON nativo, FKs explícitas.
- Erros padronizados: `{ message, code, errors? }` (404 `not_found`, 409 `*`, 422 `validation_failed`, 500 `server_error`).
- Validação sempre no servidor (Zod nas rotas). Markdown **sempre sanitizado** no front (markdown-it com `html:false` + DOMPurify).

## Arquitetura (front-end)

- `src/api/` cliente `fetch` tipado (`client.ts`), contratos (`types.ts`) e funções por recurso (`index.ts`).
- `src/stores/` Pinia (setup stores): `profile`, `roadmap`, `topic`, `projects`, `reviews`, `journal`, `dashboard`, `ui`.
- `src/pages/` páginas finas; `src/components/` componentes pequenos por domínio; `src/composables/` lógica reutilizável.
- Toda tela tem estados de loading/erro/vazio (`components/common`). Acessibilidade: foco visível, labels, `aria-*`, contraste AA, tema claro/escuro.
- Testes: `__tests__/` ao lado do código; mock da API com `vi.mock('@/api')`.

## Convenções

- Commits pequenos no padrão **Conventional Commits** (`feat:`, `fix:`, `docs:`, `test:`, `chore:`...), um por etapa lógica.
- TypeScript estrito nos dois projetos; sem `any` (exceção apenas em `tests/helpers.ts`).
- Prettier: sem ponto-e-vírgula, aspas simples, largura 100. Rodar `npm run format` antes de commitar.
- Sem segredos no repositório: use `.env` (ignorado) e mantenha `.env.example` atualizado.
- Ao mudar um DTO em `backend/src/dto.ts`, atualize `frontend/src/api/types.ts` e os testes.
- Ao mudar o schema do banco: editar `src/db/schema.ts` e rodar `npm run db:generate` (commitar a migration em `backend/drizzle/`).

## Como adicionar conteúdo

- **Tópico**: acrescente um objeto em `backend/database/seed-data/topics/<trilha>.json` (campos em `src/seed/schema.ts`:
  `slug` com prefixo da trilha, `level`, `difficulty` 1–5, `prerequisites`, `resources`, `checklist` de 3–6 itens com `key` estável).
  Rode `npm run seed:validate` e `npm run db:seed`. Não troque o `slug`/`key` de itens existentes (perde o vínculo com o progresso).
- **Projeto**: acrescente em `backend/database/seed-data/projects/*.json` (4–6 etapas, XP 15–60, critérios de aceite).
- **Pré-requisito entre trilhas**: `backend/database/seed-data/cross-prerequisites.json`.
- Links em `resources` só quando a URL existe (confira com `npm run seed:check-urls`); na dúvida, deixe apenas o nome.
