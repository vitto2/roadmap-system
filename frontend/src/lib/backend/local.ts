import { PGlite } from '@electric-sql/pglite'
import { toApiError } from './errors'
import type { AuthUser, Backend } from './types'

// O modo demo roda o MESMO SQL de supabase/ (migrations + seed) num Postgres em WebAssembly (PGlite),
// dentro do navegador. Serve para experimentar o app sem conta no Supabase e para testar o front-end
// de ponta a ponta. Nunca é incluído no build de produção (import dinâmico em ./index.ts).
const sql = import.meta.glob<string>(
  [
    '../../../../supabase/local/auth_stub.sql',
    '../../../../supabase/migrations/*.sql',
    '../../../../supabase/seed.sql',
  ],
  { query: '?raw', import: 'default', eager: true },
)

const DEMO_USER: AuthUser = { id: '00000000-0000-4000-8000-0000000000d1', email: 'demo@local' }
const DATABASE = 'idb://trilha-senior-demo'

const byName = (suffix: string) => Object.entries(sql).filter(([path]) => path.endsWith(suffix))
const stubSql = byName('auth_stub.sql')[0]![1]
const migrationSql = Object.entries(sql)
  .filter(([path]) => path.includes('/migrations/'))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, text]) => text)
const seedSql = byName('seed.sql')[0]![1]

/** Identifica a versão do SQL embutido: se mudar, o banco demo persistido é recriado. */
function sqlVersion(): string {
  let hash = 5381
  for (const text of [stubSql, ...migrationSql, seedSql]) {
    for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
  }
  return String(hash)
}

async function prepare(db: PGlite): Promise<void> {
  const version = sqlVersion()
  const meta = await db.query<{ ok: boolean }>(
    "select to_regclass('public.demo_meta') is not null as ok",
  )
  if (meta.rows[0]?.ok) {
    const current = await db.query<{ version: string }>('select version from public.demo_meta')
    if (current.rows[0]?.version === version) return
  }

  // primeira execução (ou SQL novo): recria tudo
  await db.exec(`
    drop schema if exists app cascade;
    drop schema if exists auth cascade;
    drop schema if exists supabase_migrations cascade;
    drop table if exists public.demo_meta;
    do $$
    declare r record;
    begin
      for r in select p.oid::regprocedure as sig from pg_proc p
               where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' loop
        execute 'drop function ' || r.sig;
      end loop;
    end $$;
  `)
  await db.exec(stubSql)
  for (const migration of migrationSql) await db.exec(migration)
  await db.exec(seedSql)
  await db.query('insert into auth.users (id, email) values ($1, $2) on conflict do nothing', [
    DEMO_USER.id,
    DEMO_USER.email,
  ])
  await db.exec('create table public.demo_meta (version text not null)')
  await db.query('insert into public.demo_meta (version) values ($1)', [version])
}

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/

export interface LocalBackendOptions {
  /** Guarda os dados no IndexedDB do navegador (padrão: só em memória). */
  persist?: boolean
}

export async function createLocalBackend({
  persist = false,
}: LocalBackendOptions = {}): Promise<Backend> {
  const db = new PGlite(persist ? DATABASE : undefined)
  await db.waitReady
  await prepare(db)

  let signedIn = true
  const listeners = new Set<(user: AuthUser | null) => void>()
  const notify = () => {
    const user = signedIn ? DEMO_USER : null
    for (const listener of listeners) listener(user)
  }

  return {
    mode: 'local',

    async rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
      if (!IDENTIFIER.test(fn)) throw new Error(`Função inválida: ${fn}`)
      const names = Object.keys(args)
      if (!names.every((name) => IDENTIFIER.test(name)))
        throw new Error(`Argumentos inválidos para ${fn}`)

      const placeholders = names.map((name, i) => `${name} => $${i + 1}`).join(', ')
      const values = names.map((name) => {
        const value = args[name]
        return value !== null && typeof value === 'object' ? JSON.stringify(value) : value
      })

      try {
        // como o PostgREST: papel `authenticated` + claims do JWT, dentro de uma transação por chamada
        return await db.transaction(async (tx) => {
          const claims = JSON.stringify({ sub: DEMO_USER.id, role: 'authenticated' })
          await tx.query("select set_config('request.jwt.claims', $1, true)", [claims])
          await tx.exec('set local role authenticated')
          const result = await tx.query<{ result: T }>(
            `select public.${fn}(${placeholders}) as result`,
            values,
          )
          return result.rows[0]!.result
        })
      } catch (error) {
        const e = error as { message?: string; code?: string; hint?: string; detail?: string }
        throw toApiError({
          message: e.message ?? 'Erro no banco local.',
          code: e.code,
          hint: e.hint,
          details: e.detail,
          status: 500,
        })
      }
    },

    auth: {
      getUser: async () => (signedIn ? DEMO_USER : null),
      onChange(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      async signIn() {
        signedIn = true
        notify()
      },
      async signUp() {
        signedIn = true
        notify()
        return { needsConfirmation: false }
      },
      async signOut() {
        signedIn = false
        notify()
      },
    },
  }
}
