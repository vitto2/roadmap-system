import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '@/api/client'
import { setBackend, type AuthUser, type Backend } from '@/lib/backend'
import { useAuthStore } from '../auth'

/** Backend falso com sessão controlável. */
function fakeBackend(initial: AuthUser | null = null) {
  let current = initial
  const listeners = new Set<(user: AuthUser | null) => void>()
  const calls: string[] = []
  const notify = () => listeners.forEach((listener) => listener(current))

  const backend: Backend = {
    mode: 'supabase',
    rpc: () => Promise.reject(new Error('rpc não usado')),
    auth: {
      getUser: async () => current,
      onChange(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      async signIn(email, password) {
        calls.push(`signIn:${email}`)
        if (password === 'errada')
          throw new ApiError(400, 'invalid_credentials', 'E-mail ou senha incorretos.')
        current = { id: 'u1', email }
      },
      async signUp(email, _password) {
        calls.push(`signUp:${email}`)
        if (email.startsWith('confirma')) return { needsConfirmation: true }
        current = { id: 'u2', email }
        return { needsConfirmation: false }
      },
      async signOut() {
        calls.push('signOut')
        current = null
        notify()
      },
    },
  }
  return {
    backend,
    calls,
    /** Simula logout/expiração vindos de fora (outra aba, token vencido). */
    expireSession() {
      current = null
      notify()
    },
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
})
afterEach(() => {
  setBackend(undefined)
})

describe('auth store', () => {
  it('lê a sessão existente ao iniciar (uma única vez)', async () => {
    const fake = fakeBackend({ id: 'u1', email: 'eu@exemplo.com' })
    setBackend(fake.backend)
    const auth = useAuthStore()

    expect(auth.ready).toBe(false)
    await Promise.all([auth.init(), auth.init()])
    expect(auth.ready).toBe(true)
    expect(auth.authenticated).toBe(true)
    expect(auth.user?.email).toBe('eu@exemplo.com')
  })

  it('sem sessão, não está autenticado', async () => {
    setBackend(fakeBackend().backend)
    const auth = useAuthStore()
    await auth.init()
    expect(auth.ready).toBe(true)
    expect(auth.authenticated).toBe(false)
  })

  it('acompanha o fim da sessão (logout/expiração) vindo de fora', async () => {
    const fake = fakeBackend({ id: 'u1', email: 'eu@exemplo.com' })
    setBackend(fake.backend)
    const auth = useAuthStore()
    await auth.init()

    fake.expireSession()
    expect(auth.authenticated).toBe(false)
  })

  it('entra com e-mail e senha (e remove espaços do e-mail)', async () => {
    const fake = fakeBackend()
    setBackend(fake.backend)
    const auth = useAuthStore()
    await auth.init()

    expect(await auth.signIn('  eu@exemplo.com ', 'segredo')).toBe(true)
    expect(fake.calls).toEqual(['signIn:eu@exemplo.com'])
    expect(auth.authenticated).toBe(true)
    expect(auth.error).toBeNull()
  })

  it('mostra o erro (em português) quando a senha está errada e não autentica', async () => {
    setBackend(fakeBackend().backend)
    const auth = useAuthStore()
    await auth.init()

    expect(await auth.signIn('eu@exemplo.com', 'errada')).toBe(false)
    expect(auth.error).toBe('E-mail ou senha incorretos.')
    expect(auth.authenticated).toBe(false)
    expect(auth.loading).toBe(false)
  })

  it('cadastro: avisa para confirmar o e-mail quando o projeto exige confirmação', async () => {
    setBackend(fakeBackend().backend)
    const auth = useAuthStore()
    await auth.init()

    expect(await auth.signUp('confirma@exemplo.com', 'segredo123')).toBe(false)
    expect(auth.notice).toContain('Confirme seu e-mail')
    expect(auth.authenticated).toBe(false)
  })

  it('cadastro sem confirmação já entra', async () => {
    setBackend(fakeBackend().backend)
    const auth = useAuthStore()
    await auth.init()

    expect(await auth.signUp('novo@exemplo.com', 'segredo123')).toBe(true)
    expect(auth.user?.email).toBe('novo@exemplo.com')
  })

  it('sair limpa o usuário', async () => {
    const fake = fakeBackend({ id: 'u1', email: 'eu@exemplo.com' })
    setBackend(fake.backend)
    const auth = useAuthStore()
    await auth.init()

    await auth.signOut()
    expect(fake.calls).toContain('signOut')
    expect(auth.user).toBeNull()
    expect(auth.authenticated).toBe(false)
  })
})
