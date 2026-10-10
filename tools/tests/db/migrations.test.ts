import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { applyMigrations } from '../../src/db/apply'
import { listMigrations } from '../../src/db/migrations'
import { LOCAL_STUB_FILE } from '../../src/paths'

let db: PGlite | undefined
afterEach(async () => {
  await db?.close()
  db = undefined
})

describe('migrations', () => {
  it('seguem o padrão <versão>_<nome>.sql com versões únicas e crescentes', () => {
    const migrations = listMigrations()
    expect(migrations.length).toBeGreaterThanOrEqual(6)
    const versions = migrations.map((m) => m.version)
    expect(new Set(versions).size).toBe(versions.length)
    expect([...versions].sort()).toEqual(versions)
    for (const m of migrations) expect(m.sql.trim().length).toBeGreaterThan(0)
  })

  it('aplica todas, registra na tabela da CLI do Supabase e não reaplica', async () => {
    db = new PGlite()
    await db.exec(readFileSync(LOCAL_STUB_FILE, 'utf8'))
    const migrations = listMigrations()

    const first = await applyMigrations(db, migrations)
    expect(first).toEqual(migrations.map((m) => m.file))
    const second = await applyMigrations(db, migrations)
    expect(second).toEqual([])

    const rows = await db.query<{ version: string; name: string }>(
      'select version, name from supabase_migrations.schema_migrations order by version',
    )
    expect(rows.rows.map((r) => r.version)).toEqual(migrations.map((m) => m.version))
  })

  it('uma migration com erro é desfeita por inteiro e não fica registrada', async () => {
    db = new PGlite()
    const ok = { version: '1', name: 'ok', file: '1_ok.sql', sql: 'create table t_ok (id int);' }
    const bad = {
      version: '2',
      name: 'bad',
      file: '2_bad.sql',
      sql: 'create table t_bad (id int); select 1 / 0;',
    }
    await expect(applyMigrations(db, [ok, bad])).rejects.toThrow(/2_bad\.sql/)

    const tables = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public'`,
    )
    expect(tables.rows.map((r) => r.table_name)).toEqual(['t_ok'])
    const versions = await db.query<{ version: string }>(
      'select version from supabase_migrations.schema_migrations',
    )
    expect(versions.rows.map((r) => r.version)).toEqual(['1'])

    // corrigida, a migration pendente entra normalmente
    const fixed = { ...bad, sql: 'create table t_bad (id int);' }
    expect(await applyMigrations(db, [ok, fixed])).toEqual(['2_bad.sql'])
  })
})
