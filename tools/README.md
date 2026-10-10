# Trilha Sênior — tools

Ferramentas do banco (Supabase/Postgres) e do conteúdo. Passo a passo completo no [README da raiz](../README.md).

```bash
npm install
npm test                    # migrations + regras + RLS + permissões + contrato JSON, em PGlite (sem Docker)
npm run content:validate    # valida content/*.json (formato, slugs, pré-requisitos, ciclos, projetos)
npm run content:build       # gera ../supabase/seed.sql
npm run content:check-urls  # confere os links dos recursos (rede)

cp .env.example .env        # DATABASE_URL do Supabase (Session pooler)
npm run db:setup            # migrations pendentes + conteúdo (idempotente)
npm run db:migrate          # só as migrations
npm run db:seed             # só o conteúdo
```

- `src/content/` — esquema Zod dos JSON, leitura/validação, gerador do payload e do `seed.sql`.
- `src/db/` — aplicação das migrations (registradas em `supabase_migrations.schema_migrations`, como a CLI do Supabase),
  carga do conteúdo e `cli.ts` (usa `pg`).
- `tests/` — `db/*` testam o SQL como o PostgREST o usa (papel `authenticated` + claims do JWT); `content.test.ts` valida o
  conteúdo real e se o `seed.sql` está atualizado.
