import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MIGRATIONS_DIR } from '../paths'

export interface Migration {
  /** Prefixo numérico do arquivo (ex.: 20261010000001). */
  version: string
  name: string
  file: string
  sql: string
}

/** Lê as migrations (supabase/migrations/<versão>_<nome>.sql) em ordem de versão. */
export function listMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  return readdirSync(dir)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort()
    .map((file) => {
      const [, version, name] = /^(\d+)_(.+)\.sql$/.exec(file)!
      return { version: version!, name: name!, file, sql: readFileSync(join(dir, file), 'utf8') }
    })
}
