import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { StudySession } from '@/api/types'
import { makeProfile } from '@/test/factories'
import { useJournalStore } from '../journal'
import { useProfileStore } from '../profile'

vi.mock('@/api')
import { api } from '@/api'

const session = (id: number): StudySession => ({
  id,
  studiedOn: '2026-03-10',
  durationMinutes: 30,
  topic: null,
  note: `Sessão ${id}`,
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('journal store', () => {
  it('pagina o histórico', async () => {
    vi.mocked(api.sessions)
      .mockResolvedValueOnce({
        data: [session(1), session(2)],
        meta: { page: 1, perPage: 2, total: 3 },
      })
      .mockResolvedValueOnce({ data: [session(3)], meta: { page: 2, perPage: 2, total: 3 } })
    const store = useJournalStore()

    await store.load()
    expect(store.sessions).toHaveLength(2)
    expect(store.hasMore).toBe(true)

    await store.loadMore()
    expect(api.sessions).toHaveBeenLastCalledWith(2, 20)
    expect(store.sessions.map((s) => s.id)).toEqual([1, 2, 3])
    expect(store.hasMore).toBe(false)
  })

  it('registrar uma sessão aplica o perfil e recarrega a lista', async () => {
    useProfileStore().profile = makeProfile()
    vi.mocked(api.createSession).mockResolvedValue({
      data: session(1),
      profile: makeProfile(),
    })
    vi.mocked(api.sessions).mockResolvedValue({
      data: [session(1)],
      meta: { page: 1, perPage: 20, total: 1 },
    })
    const store = useJournalStore()

    expect(await store.create({ durationMinutes: 30 })).toBe(true)
    expect(api.createSession).toHaveBeenCalledWith({ durationMinutes: 30 })
    expect(store.sessions).toHaveLength(1)
    expect(store.saving).toBe(false)
  })

  it('devolve false e mantém a lista quando o servidor recusa', async () => {
    vi.mocked(api.createSession).mockRejectedValue(new Error('inválido'))
    const store = useJournalStore()
    expect(await store.create({ durationMinutes: 0 })).toBe(false)
    expect(store.saving).toBe(false)
  })
})
