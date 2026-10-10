# supabase/

SQL do app (Postgres/Supabase). Como aplicar: veja o [README da raiz](../README.md) (`npm run db:setup` em `tools/`, ou
colar os arquivos no SQL Editor).

| Arquivo | O que faz |
| --- | --- |
| `migrations/..._schema.sql` | Tabelas do esquema `app` (conteúdo e progresso), RLS, políticas e permissões. |
| `migrations/..._helpers.sql` | `app.now`, erros padronizados (`PTnnn`), regras puras de XP/nível, fuso, `app.lock_down_api`. |
| `migrations/..._content_sync.sql` | `app.sync_content(jsonb)`: carga idempotente do conteúdo (arquiva o que sumir). |
| `migrations/..._read_models.sql` | Montagem dos JSON: tópicos, projetos, revisões, XP, carreira, streak, perfil, dashboard, grafo. |
| `migrations/..._actions.sql` | Validações e ações (concluir/reabrir, diário, backup/restauração). |
| `migrations/..._api.sql` | Funções RPC públicas (`public.*`) chamadas pelo front-end; fecha o acesso de `anon`. |
| `seed.sql` | Conteúdo do roadmap, **gerado** de `../content` (`npm run content:build` em `tools/`). |
| `local/auth_stub.sql` | Só para testes/modo demo: simula `auth.users`, `auth.uid()` e os papéis do Supabase no PGlite. |

Não edite migrations já aplicadas: crie uma nova (`<timestamp>_<nome>.sql`) e rode `select app.lock_down_api();` no fim se ela
criar funções em `public`.
