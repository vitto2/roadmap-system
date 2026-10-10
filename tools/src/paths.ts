import { fileURLToPath } from 'node:url'

/** Raiz do repositório (tools/src/paths.ts -> ../../). */
export const ROOT = fileURLToPath(new URL('../../', import.meta.url))

/** Conteúdo do roadmap (JSON): trilhas, tópicos, projetos, pré-requisitos entre trilhas. */
export const CONTENT_DIR = fileURLToPath(new URL('../../content', import.meta.url))

/** Migrations SQL (compatíveis com a CLI do Supabase). */
export const MIGRATIONS_DIR = fileURLToPath(new URL('../../supabase/migrations', import.meta.url))

/** Seed gerado a partir de content/ (carrega o conteúdo no banco). */
export const SEED_FILE = fileURLToPath(new URL('../../supabase/seed.sql', import.meta.url))

/** SQL que simula o mínimo do Supabase (auth + papéis) para rodar tudo em PGlite. */
export const LOCAL_STUB_FILE = fileURLToPath(
  new URL('../../supabase/local/auth_stub.sql', import.meta.url),
)
