# Trilha Sênior

Roadmap interativo e gamificado para estudar programação até o nível **sênior**. Você marca os tópicos que já
estudou, cumpre projetos desafio por etapas, revisa o que aprendeu (revisão espaçada) e acumula **XP**.
Uso pessoal (single-user), interface em português do Brasil.

- **10 trilhas** (Fundamentos, Web base, Vue, PHP/Laravel, SQL, Qualidade, Arquitetura, DevOps, Segurança, Carreira),
  com mais de 130 tópicos organizados por nível de carreira, cada um com checklist "como sei que dominei" e recursos oficiais.
- **Projetos desafio** do júnior ao sênior, com etapas, critérios de aceite e XP.
- **Revisões** em 7, 30 e 90 dias, **diário de estudo**, streak, meta semanal e **dashboard** (radar por trilha, sessões por semana).
- Tema claro/escuro, responsivo, com acessibilidade básica.

> O conteúdo ensina PHP/Laravel e Vue, mas o app em si é feito em TypeScript:
> `backend/` (Node + Fastify + SQLite) e `frontend/` (Vue 3 + Vite). Docker **não** é necessário.

## Pré-requisitos

- Node.js **22.18+** (ou 24) e npm
- Git

## Instalação e execução

```bash
git clone https://github.com/vitto2/roadmap-system.git
cd roadmap-system

# 1) Back-end (API em http://127.0.0.1:8000)
cd backend
npm install
cp .env.example .env     # opcional
npm run db:setup         # cria o banco SQLite, aplica migrations e carrega o conteúdo
npm run dev

# 2) Front-end (em outro terminal) — http://localhost:5173
cd frontend
npm install
npm run dev
```

O Vite encaminha `/api` para `127.0.0.1:8000` (proxy), então não precisa configurar CORS no desenvolvimento.
Em outros domínios, defina `CORS_ORIGIN` no back-end e `VITE_API_URL` no front-end.

## Conteúdo (seed)

O conteúdo vive em `backend/database/seed-data/` e **nunca sobrescreve seu progresso**:

```bash
cd backend
npm run seed:validate     # confere formato e integridade (pré-requisitos, ciclos, projetos)
npm run db:seed           # carrega/atualiza (idempotente: upsert pelo slug)
npm run seed:check-urls   # confere se os links dos recursos ainda respondem
```

Se um item sumir do JSON, ele é **arquivado** (some da interface) em vez de apagado; se voltar, reaparece com o progresso.

### Adicionar tópicos

Edite `backend/database/seed-data/topics/<trilha>.json` e acrescente um objeto:

```json
{
  "slug": "php-meu-novo-topico",
  "title": "Meu novo tópico",
  "description": "O que é, por que importa e o escopo.",
  "level": "mid",
  "difficulty": 3,
  "prerequisites": ["php-poo"],
  "resources": [{ "name": "Documentação oficial", "url": "https://laravel.com/docs" }, { "name": "Livro X" }],
  "checklist": [
    { "key": "explicar-conceito", "text": "Consigo explicar o conceito com minhas palavras." },
    { "key": "aplicar-exemplo", "text": "Já apliquei em um exemplo real." },
    { "key": "reconhecer-erros", "text": "Sei reconhecer os erros mais comuns." }
  ]
}
```

`level`: `beginner | junior | mid | senior`. `difficulty` (1–5) define o XP (`dificuldade × 10`).
Mantenha `slug` e `key` estáveis. Depois rode `npm run seed:validate && npm run db:seed`.

### Adicionar projetos

Edite (ou crie) um arquivo em `backend/database/seed-data/projects/` com título, descrição, `level`, `difficulty`,
`topics` (slugs relacionados) e de 4 a 6 `milestones` (`key`, `title`, `acceptanceCriteria[]`, `xp` entre 15 e 60).

## Regras de pontuação

Calculadas **somente no back-end** (`backend/src/domain/scoring`); o front-end apenas exibe.

| Evento | XP |
| --- | --- |
| Tópico concluído | dificuldade × 10 (10 a 50) |
| Etapa de projeto concluída | definido na etapa (15 a 60) |
| Projeto finalizado | +100 (+50 com repositório, +50 com deploy) |
| Revisão espaçada concluída | 25% do XP do tópico |
| Nível N (gamificação) | 100 × N^1,5 XP para completar o nível |

O XP é **derivado do estado** (desmarcar/reabrir desfaz o XP). Concluir exige o checklist completo; **"Já domino"** marca tudo
e agenda só a revisão de 90 dias. Quebrar o streak não tira XP. O nível de carreira (Iniciante → Sênior) exige 40%/60%/80% de
progresso nas trilhas obrigatórias.

## Testes e qualidade

```bash
cd backend  && npm test && npm run lint && npm run format:check && npm run typecheck
cd frontend && npm test && npm run lint && npm run format:check && npm run type-check
```

O CI (`.github/workflows/ci.yml`) roda tudo isso a cada push/PR.

## Estrutura

```
backend/   API (src/domain, src/actions, src/services, src/http, src/db, src/seed) + database/seed-data
frontend/  SPA (src/api, src/stores, src/pages, src/components, src/composables)
docs/      plano original do projeto
CLAUDE.md  convenções e decisões de arquitetura
```
