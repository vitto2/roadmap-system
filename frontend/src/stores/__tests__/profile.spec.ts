import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { makeProfile } from '@/test/factories'
import { useProfileStore } from '../profile'
import { useUiStore } from '../ui'

vi.mock('@/api')
import { api } from '@/api'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('profile store', () => {
  it('carrega o perfil da API', async () => {
    vi.mocked(api.profile).mockResolvedValue(makeProfile({ total: 40 }))
    const store = useProfileStore()
    await store.load()
    expect(store.profile?.xp.total).toBe(40)
    expect(store.error).toBeNull()
  })

  it('guarda o erro amigável quando a API falha', async () => {
    vi.mocked(api.profile).mockRejectedValue(new Error('API fora do ar'))
    const store = useProfileStore()
    await store.load()
    expect(store.profile).toBeNull()
    expect(store.error).toBe('API fora do ar')
  })

  it('apply devolve a variação de XP e avisa por toast', () => {
    const store = useProfileStore()
    const ui = useUiStore()
    store.profile = makeProfile({ total: 10 })

    expect(store.apply(makeProfile({ total: 40 }))).toBe(30)
    expect(ui.toasts.map((t) => t.message)).toContain('+30 XP')

    expect(store.apply(makeProfile({ total: 10 }))).toBe(-30)
    expect(ui.toasts.map((t) => t.message)).toContain('-30 XP')
    expect(store.profile?.xp.total).toBe(10)
  })

  it('avisa quando sobe de nível', () => {
    const store = useProfileStore()
    const ui = useUiStore()
    store.profile = makeProfile({ total: 90, level: 1 })
    store.apply(makeProfile({ total: 130, level: 2 }))
    expect(ui.toasts.some((t) => t.message.includes('nível 2'))).toBe(true)
  })

  it('não mostra toast sem variação de XP', () => {
    const store = useProfileStore()
    const ui = useUiStore()
    store.profile = makeProfile({ total: 10 })
    expect(store.apply(makeProfile({ total: 10 }))).toBe(0)
    expect(ui.toasts).toHaveLength(0)
  })
})
