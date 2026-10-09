# Trilha Sênior — back-end

API REST (Node 22+, Fastify 5, Drizzle ORM + SQLite, Zod). Veja o [README da raiz](../README.md) para instalação
e o [CLAUDE.md](../CLAUDE.md) para arquitetura e convenções.

```bash
npm install
npm run db:setup     # migrations + seed idempotente (cria data/trilha.sqlite)
npm run dev          # http://127.0.0.1:8000  (docs: /api/docs)
npm test             # Vitest: regras de domínio, seed e endpoints
npm run lint && npm run format:check && npm run typecheck
```

- `src/domain/scoring`: regras puras de XP, níveis, carreira, revisão espaçada e streak.
- `src/actions` / `src/services`: casos de uso (mutações) e leituras; `src/http`: rotas finas em `/api/v1`.
- `database/seed-data`: conteúdo do roadmap em JSON (trilhas, tópicos, projetos, pré-requisitos entre trilhas).
- Variáveis de ambiente em `.env.example` (porta, banco, fuso, meta semanal, CORS, login opcional).
