import type { Backend } from './types'

export type { AuthUser, Backend, BackendAuth, RpcError } from './types'

const env = import.meta.env

/** `local`: roda o MESMO SQL no navegador (PGlite) — modo demo, sem Supabase. */
export const isDemoMode = env.VITE_DATA_MODE === 'local'

/** Cadastro pela tela de login (desligue depois de criar sua conta: VITE_ALLOW_SIGNUP=false). */
export const allowSignUp = env.VITE_ALLOW_SIGNUP !== 'false'

export function isBackendConfigured(): boolean {
  return isDemoMode || Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY)
}

let instance: Promise<Backend> | undefined

async function create(): Promise<Backend> {
  if (isDemoMode) {
    // import dinâmico: o PGlite (Postgres em WebAssembly) só entra no modo demo, nunca no build de produção
    const { createLocalBackend } = await import('@/lib/backend/local')
    return createLocalBackend({ persist: true })
  }
  const { createSupabaseBackend } = await import('./supabase')
  return createSupabaseBackend(env.VITE_SUPABASE_URL ?? '', env.VITE_SUPABASE_ANON_KEY ?? '')
}

/** Backend único do app (criado na primeira chamada). */
export function getBackend(): Promise<Backend> {
  instance ??= create()
  return instance
}

/** Troca o backend (testes). */
export function setBackend(backend: Backend | undefined): void {
  instance = backend ? Promise.resolve(backend) : undefined
}
