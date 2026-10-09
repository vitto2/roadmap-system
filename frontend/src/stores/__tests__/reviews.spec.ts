import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '@/api/client'
import type { Review } from '@/api/types'
import { makeProfile } from '@/test/factories'
import { useProfileStore } from '../profile'
import { useReviewsStore } from '../reviews'
import { useUiStore } from '../ui'

vi.mock('@/api')
import { api } from '@/api'

const review = (id: number, overrides: Partial<Review> = {}): Review => ({
  id,
  topic: { slug: `t${id}`, title: `Tópico ${id}` },
  intervalDays: 7,
  dueOn: '2026-03-10',
  completedAt: null,
  xp: 5,
  overdue: false,
  ...overrides,
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('reviews store', () => {
  it('carrega a fila de hoje e atualiza o contador do menu', async () => {
    vi.mocked(api.reviews).mockResolvedValue([review(1), review(2, { overdue: true })])
    const store = useReviewsStore()
    await store.load('today')
    expect(store.items).toHaveLength(2)
    expect(store.dueCount).toBe(2)
    expect(store.overdueCount).toBe(1)
  })

  it('não altera o contador ao ver outra aba', async () => {
    vi.mocked(api.reviews).mockResolvedValueOnce([review(1)])
    const store = useReviewsStore()
    await store.load('today')
    vi.mocked(api.reviews).mockResolvedValueOnce([review(8), review(9), review(10)])
    await store.load('upcoming')
    expect(store.items).toHaveLength(3)
    expect(store.dueCount).toBe(1)
  })

  it('concluir aplica o XP do servidor e recarrega a fila', async () => {
    const profile = useProfileStore()
    profile.profile = makeProfile({ total: 40 })
    vi.mocked(api.reviews)
      .mockResolvedValueOnce([review(1)])
      .mockResolvedValue([])
    vi.mocked(api.completeReview).mockResolvedValue({
      data: review(1, { completedAt: '2026-03-10T10:00:00Z' }),
      profile: makeProfile({ total: 45 }),
    })

    const store = useReviewsStore()
    await store.load('today')
    expect(await store.complete(1)).toBe(true)

    expect(api.completeReview).toHaveBeenCalledWith(1)
    expect(profile.profile?.xp.total).toBe(45)
    expect(store.items).toHaveLength(0)
    expect(store.dueCount).toBe(0)
    expect(store.busyId).toBeNull()
  })

  it('mostra erro como toast quando a conclusão falha', async () => {
    vi.mocked(api.completeReview).mockRejectedValue(
      new ApiError(404, 'not_found', 'Revisão não encontrada(a).'),
    )
    const store = useReviewsStore()
    expect(await store.complete(99)).toBe(false)
    expect(useUiStore().toasts[0]?.kind).toBe('error')
    expect(store.busyId).toBeNull()
  })
})
