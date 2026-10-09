import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

export type Db = BetterSQLite3Database<typeof schema>

export interface DbHandle {
  db: Db
  close: () => void
}

const migrationsFolder = new URL('../../drizzle', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
)

/** Abre (e cria, se preciso) o banco SQLite. Use ':memory:' nos testes. */
export function createDb(path: string): DbHandle {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const sqlite = new Database(path)
  sqlite.pragma('foreign_keys = ON')
  if (path !== ':memory:') sqlite.pragma('journal_mode = WAL')
  const db = drizzle(sqlite, { schema })
  return { db, close: () => sqlite.close() }
}

export function runMigrations(db: Db): void {
  migrate(db, { migrationsFolder: decodeURIComponent(migrationsFolder) })
}
