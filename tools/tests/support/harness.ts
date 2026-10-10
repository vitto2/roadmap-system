/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PGlite } from '@electric-sql/pglite'
import { syncContent } from '../../src/db/apply'
import { createMigratedDb } from '../../src/db/pglite'
import { sampleContent } from './sample'

export const ALICE = '00000000-0000-4000-8000-00000000000a'
export const BOB = '00000000-0000-4000-8000-00000000000b'

export type Json = any

export interface DbError extends Error {
  /** SQLSTATE (ex.: PT409 => HTTP 409). */
  code: string
  hint?: string
  detail?: string
}

export interface Client {
  /** Chama public.<fn>(...) como esse usuário (papel authenticated + claims do JWT), como o PostgREST faz. */
  rpc<T = Json>(fn: string, args?: Record<string, unknown>): Promise<T>
  /** SQL livre com o papel/claims do usuário (para checar RLS). */
  query<T = Json>(sql: string, params?: unknown[]): Promise<T[]>
}

export interface Harness {
  db: PGlite
  alice: Client
  bob: Client
  anon: Client
  /** Papel authenticated, mas sem usuário no JWT (token inválido/sem sub). */
  nobody: Client
  /** SQL como dono do banco (ignora RLS) — para preparar e inspecionar dados. */
  admin: { query<T = Json>(sql: string, params?: unknown[]): Promise<T[]> }
  /** "Agora" da aplicação (app.now()) — vale até o fim da transação do teste. */
  setNow(iso: string): Promise<void>
  /** Cada teste roda dentro de uma transação desfeita ao final. */
  begin(): Promise<void>
  rollback(): Promise<void>
}

/** Cria o banco (stub do Supabase + migrations), carrega o conteúdo de exemplo e os usuários alice e bob. */
export async function createHarness(options: { content?: boolean } = {}): Promise<Harness> {
  const db = await createMigratedDb()

  await db.query(
    `insert into auth.users (id, email) values ($1, 'alice@example.com'), ($2, 'bob@example.com')`,
    [ALICE, BOB],
  )
  if (options.content !== false) await syncContent(db, sampleContent())

  let inTransaction = false

  // Dentro de uma transação de teste, um erro não pode abortá-la: usa savepoint (como o PostgREST isola cada chamada).
  const admin = {
    async query<T = Json>(sql: string, params?: unknown[]): Promise<T[]> {
      if (!inTransaction) return (await db.query<T>(sql, params)).rows
      await db.exec('savepoint admin_call')
      try {
        const rows = (await db.query<T>(sql, params)).rows
        await db.exec('release savepoint admin_call')
        return rows
      } catch (error) {
        await db.exec('rollback to savepoint admin_call')
        await db.exec('release savepoint admin_call')
        throw error
      }
    },
  }

  const makeClient = (
    userId: string | null,
    role: 'authenticated' | 'anon' = userId ? 'authenticated' : 'anon',
  ): Client => {
    const claims = JSON.stringify(userId ? { sub: userId, role } : { role })

    // Executa `fn` com papel e claims do usuário dentro de um savepoint (um erro não aborta o teste inteiro).
    const withSession = async <T>(fn: () => Promise<T>): Promise<T> => {
      await db.exec('savepoint client_call')
      try {
        await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims])
        await db.exec(`set local role ${role}`)
        const result = await fn()
        await db.exec('reset role')
        await db.exec('release savepoint client_call')
        return result
      } catch (error) {
        await db.exec('rollback to savepoint client_call')
        await db.exec('release savepoint client_call')
        throw error
      }
    }

    return {
      async rpc<T = Json>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
        const names = Object.keys(args)
        const placeholders = names.map((name, i) => `${name} => $${i + 1}`).join(', ')
        const values = names.map((name) => {
          const value = args[name]
          return value !== null && typeof value === 'object' ? JSON.stringify(value) : value
        })
        return withSession(async () => {
          const res = await db.query<{ result: T }>(
            `select public.${fn}(${placeholders}) as result`,
            values,
          )
          return res.rows[0]!.result
        })
      },
      async query<T = Json>(sql: string, params?: unknown[]): Promise<T[]> {
        return withSession(async () => (await db.query<T>(sql, params)).rows)
      },
    }
  }

  return {
    db,
    alice: makeClient(ALICE),
    bob: makeClient(BOB),
    anon: makeClient(null),
    nobody: makeClient(null, 'authenticated'),
    admin,
    async setNow(iso: string) {
      await db.query(`select set_config('app.now', $1, true)`, [iso])
    },
    async begin() {
      await db.exec('begin')
      inTransaction = true
    },
    async rollback() {
      await db.exec('rollback')
      inTransaction = false
    },
  }
}

/** Atalho: marca todos os itens do checklist de um tópico (a-1, a-2, a-3). */
export async function checkAll(client: Client, slug: string): Promise<void> {
  for (const n of [1, 2, 3]) {
    await client.rpc('set_checklist_item', { p_slug: slug, p_key: `${slug}-${n}`, p_checked: true })
  }
}
