import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError, getToken } from '@/api/client'
import { useAuthStore } from '../auth'

vi.mock('@/api')
import { api } from '@/api'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('auth store', () => {
  it('consulta se o login é exigido apenas uma vez', async () => {
    vi.mocked(api.authStatus).mockResolvedValue({ required: true })
    const auth = useAuthStore()
    await auth.init()
    await auth.init()
    expect(api.authStatus).toHaveBeenCalledTimes(1)
    expect(auth.required).toBe(true)
    expect(auth.authenticated).toBe(false)
  })

  it('não bloqueia a navegação quando a API está fora do ar', async () => {
    vi.mocked(api.authStatus).mockRejectedValue(new Error('offline'))
    const auth = useAuthStore()
    await auth.init()
    expect(auth.required).toBe(false)
    expect(auth.authenticated).toBe(true)
  })

  it('guarda o token no login e remove no logout', async () => {
    vi.mocked(api.authStatus).mockResolvedValue({ required: true })
    vi.mocked(api.login).mockResolvedValue({ token: 'abc.def', expiresAt: '2030-01-01T00:00:00Z' })
    const auth = useAuthStore()
    await auth.init()

    expect(await auth.login('segredo')).toBe(true)
    expect(auth.authenticated).toBe(true)
    expect(getToken()).toBe('abc.def')

    auth.logout()
    expect(auth.authenticated).toBe(false)
    expect(getToken()).toBeNull()
  })

  it('expõe a mensagem de erro quando a senha está errada', async () => {
    vi.mocked(api.login).mockRejectedValue(
      new ApiError(401, 'invalid_credentials', 'Senha incorreta.'),
    )
    const auth = useAuthStore()
    expect(await auth.login('errada')).toBe(false)
    expect(auth.error).toBe('Senha incorreta.')
    expect(auth.token).toBeNull()
  })
})
