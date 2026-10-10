import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { LOCAL_STUB_FILE } from '../paths'
import { applyMigrations } from './apply'
import { listMigrations } from './migrations'

/** PGlite com o stub do Supabase (auth + papéis) e todas as migrations aplicadas. */
export async function createMigratedDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(readFileSync(LOCAL_STUB_FILE, 'utf8'))
  await applyMigrations(db, listMigrations())
  return db
}
