import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = (event: string, session: { user: { id: string; email?: string } } | null) => void

interface FakeClient {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>
  auth: {
    getSession: () => Promise<unknown>
    onAuthStateChange: (listener: Listener) => {
      data: { subscription: { unsubscribe: () => void } }
    }
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<unknown>
    signUp: (credentials: { email: string; password: string }) => Promise<unknown>
    signOut: () => Promise<unknown>
  }
}

// O cliente do supabase-js é substituído por um falso controlável (a rede nunca é usada).
const hoisted = vi.hoisted(() => ({ current: undefined as unknown }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => hoisted.current,
}))

import { createSupabaseBackend, translateAuthError } from '../supabase'

let rpcCalls: { fn: string; args: Record<string, unknown> }[]
let rpcResult: { data: unknown; error: unknown; status: number }
let session: { user: { id: string; email?: string } } | null
let authResult: {
  data?: unknown
  error?: { code?: string; message: string; status?: number } | null
}
let listener: Listener | undefined
let unsubscribed: boolean

beforeEach(() => {
  rpcCalls = []
  rpcResult = { data: { ok: true }, error: null, status: 200 }
  session = null
  authResult = { data: {}, error: null }
  listener = undefined
  unsubscribed = false

  const client: FakeClient = {
    rpc: async (fn, args) => {
      rpcCalls.push({ fn, args })
      return rpcResult
    },
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: (l) => {
        listener = l
        return { data: { subscription: { unsubscribe: () => (unsubscribed = true) } } }
      },
      signInWithPassword: async () => authResult,
      signUp: async () => authResult,
      signOut: async () => authResult,
    },
  }
  hoisted.current = client
})

describe('createSupabaseBackend — rpc', () => {
  it('chama a função RPC com os argumentos e devolve os dados', async () => {
    const backend = createSupabaseBackend('https://x.supabase.co', 'anon')
    expect(backend.mode).toBe('supabase')
    rpcResult = { data: { profile: 1 }, error: null, status: 200 }
    await expect(backend.rpc('get_profile')).resolves.toEqual({ profile: 1 })
    await backend.rpc('get_topic', { p_slug: 'a' })
    expect(rpcCalls).toEqual([
      { fn: 'get_profile', args: {} },
      { fn: 'get_topic', args: { p_slug: 'a' } },
    ])
  })

  it('converte erros do PostgREST (SQLSTATE PTnnn) em ApiError', async () => {
    const backend = createSupabaseBackend('https://x.supabase.co', 'anon')
    rpcResult = {
      data: null,
      status: 409,
      error: {
        code: 'PT409',
        message: 'Marque todos os itens do checklist antes de concluir o tópico.',
        hint: 'checklist_incomplete',
        details: null,
      },
    }
    await expect(backend.rpc('complete_topic', { p_slug: 'a' })).rejects.toMatchObject({
      status: 409,
      code: 'checklist_incomplete',
    })

    rpcResult = { data: null, status: 401, error: { code: 'PGRST301', message: 'JWT expired' } }
    await expect(backend.rpc('get_profile')).rejects.toMatchObject({
      status: 401,
      code: 'unauthenticated',
    })
  })
})

describe('createSupabaseBackend — auth', () => {
  it('getUser devolve o usuário da sessão (ou null)', async () => {
    const backend = createSupabaseBackend('https://x.supabase.co', 'anon')
    expect(await backend.auth.getUser()).toBeNull()
    session = { user: { id: 'u1', email: 'eu@exemplo.com' } }
    expect(await backend.auth.getUser()).toEqual({ id: 'u1', email: 'eu@exemplo.com' })
  })

  it('onChange repassa mudanças de sessão e permite cancelar', () => {
    const backend = createSupabaseBackend('https://x.supabase.co', 'anon')
    const seen: (string | null)[] = []
    const stop = backend.auth.onChange((user) => seen.push(user?.id ?? null))

    listener?.('SIGNED_IN', { user: { id: 'u1' } })
    listener?.('SIGNED_OUT', null)
    expect(seen).toEqual(['u1', null])

    stop()
    expect(unsubscribed).toBe(true)
  })

  it('signIn traduz credenciais inválidas para português', async () => {
    const backend = createSupabaseBackend('https://x.supabase.co', 'anon')
    authResult = {
      error: { code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 },
    }
    await expect(backend.auth.signIn('a@b.c', 'x')).rejects.toMatchObject({
      code: 'invalid_credentials',
      message: 'E-mail ou senha incorretos.',
    })
    authResult = { data: {}, error: null }
    await expect(backend.auth.signIn('a@b.c', 'certa')).resolves.toBeUndefined()
  })

  it('signUp informa se é preciso confirmar o e-mail', async () => {
    const backend = createSupabaseBackend('https://x.supabase.co', 'anon')
    authResult = { data: { session: null }, error: null }
    expect(await backend.auth.signUp('a@b.c', 'senha-forte')).toEqual({ needsConfirmation: true })
    authResult = { data: { session: { user: { id: 'u1' } } }, error: null }
    expect(await backend.auth.signUp('a@b.c', 'senha-forte')).toEqual({ needsConfirmation: false })
  })

  it('signOut propaga erros traduzidos', async () => {
    const backend = createSupabaseBackend('https://x.supabase.co', 'anon')
    await expect(backend.auth.signOut()).resolves.toBeUndefined()
    authResult = { error: { message: 'Failed to fetch', status: 0 } }
    await expect(backend.auth.signOut()).rejects.toMatchObject({ code: 'network_error' })
  })
})

describe('translateAuthError', () => {
  it.each([
    ['email_not_confirmed', 'Confirme seu e-mail'],
    ['user_already_exists', 'já tem cadastro'],
    ['signup_disabled', 'cadastros estão desativados'],
    ['weak_password', 'Senha fraca'],
    ['over_request_rate_limit', 'Muitas tentativas'],
    ['qualquer_outro', 'Não foi possível autenticar'],
  ])('%s -> mensagem amigável', (code, expected) => {
    expect(translateAuthError({ code, message: 'x', status: 400 } as never).message).toContain(
      expected,
    )
  })
})
