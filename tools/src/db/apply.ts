import type { ContentPayload } from '../content/payload'
import type { Migration } from './migrations'

/** O mínimo que precisamos de um cliente SQL (PGlite e pg, via adaptador, satisfazem isto). */
export interface SqlExecutor {
  /** Executa um ou mais comandos sem parâmetros. */
  exec(sql: string): Promise<unknown>
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
}

/**
 * Aplica as migrations pendentes, registrando-as na mesma tabela da CLI do Supabase
 * (supabase_migrations.schema_migrations), para que os dois caminhos convivam.
 * Cada migration roda numa transação: ou entra inteira ou não entra.
 */
export async function applyMigrations(
  db: SqlExecutor,
  migrations: Migration[],
  log: (message: string) => void = () => {},
): Promise<string[]> {
  await db.exec(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text not null primary key,
      statements text[],
      name text
    );
  `)

  const applied = new Set(
    (
      await db.query<{ version: string }>(
        'select version from supabase_migrations.schema_migrations',
      )
    ).rows.map((r) => r.version),
  )

  const done: string[] = []
  for (const migration of migrations) {
    if (applied.has(migration.version)) continue
    log(`aplicando ${migration.file}`)
    await db.exec('begin')
    try {
      await db.exec(migration.sql)
      await db.query(
        'insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)',
        [migration.version, migration.name, [migration.sql]],
      )
      await db.exec('commit')
    } catch (error) {
      await db.exec('rollback')
      throw new Error(
        `Falha na migration ${migration.file}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      )
    }
    done.push(migration.file)
  }
  return done
}

export interface SeedSummary {
  tracks: number
  topics: number
  checklistItems: number
  projects: number
  milestones: number
  archived: {
    tracks: number
    topics: number
    checklistItems: number
    projects: number
    milestones: number
  }
}

/** Carrega/atualiza o conteúdo (idempotente). Roda como dono do banco. */
export async function syncContent(db: SqlExecutor, payload: ContentPayload): Promise<SeedSummary> {
  const result = await db.query<{ summary: SeedSummary }>(
    'select app.sync_content($1::jsonb) as summary',
    [JSON.stringify(payload)],
  )
  return result.rows[0]!.summary
}
