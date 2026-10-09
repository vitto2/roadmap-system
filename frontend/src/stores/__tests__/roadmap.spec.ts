import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { makeTopicSummary, makeTrack } from '@/test/factories'
import { useRoadmapStore } from '../roadmap'

vi.mock('@/api')
import { api } from '@/api'

const topics = [
  makeTopicSummary({ slug: 'a', careerLevel: 'beginner', status: 'completed' }),
  makeTopicSummary({ slug: 'b', careerLevel: 'junior', status: 'studying' }),
  makeTopicSummary({ slug: 'c', careerLevel: 'junior', status: 'not_started' }),
  makeTopicSummary({ slug: 'd', trackSlug: 'outra', careerLevel: 'mid', status: 'not_started' }),
]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.mocked(api.tracks).mockResolvedValue([makeTrack(), makeTrack({ slug: 'outra' })])
  vi.mocked(api.topics).mockResolvedValue(topics)
})

describe('roadmap store', () => {
  it('carrega trilhas e tópicos uma vez; recarrega quando invalidado', async () => {
    const store = useRoadmapStore()
    await store.ensureLoaded()
    await store.ensureLoaded()
    expect(api.tracks).toHaveBeenCalledTimes(1)
    expect(store.tracks).toHaveLength(2)

    store.invalidate()
    await store.ensureLoaded()
    expect(api.tracks).toHaveBeenCalledTimes(2)
    expect(store.stale).toBe(false)
  })

  it('filtra por nível e status e agrupa por trilha', async () => {
    const store = useRoadmapStore()
    await store.load()
    expect(store.hasActiveFilters).toBe(false)
    expect(store.filteredByTrack.get('trilha-a')).toHaveLength(3)

    store.setLevelFilter('junior')
    expect(store.hasActiveFilters).toBe(true)
    expect(store.filteredByTrack.get('trilha-a')?.map((t) => t.slug)).toEqual(['b', 'c'])
    expect(store.filteredByTrack.has('outra')).toBe(false)

    store.setStatusFilter('studying')
    expect(store.filteredByTrack.get('trilha-a')?.map((t) => t.slug)).toEqual(['b'])

    store.clearFilters()
    expect(store.hasActiveFilters).toBe(false)
    expect(store.filteredByTrack.get('outra')).toHaveLength(1)
  })

  it('expõe o erro quando a API falha', async () => {
    vi.mocked(api.tracks).mockRejectedValue(new Error('sem conexão'))
    const store = useRoadmapStore()
    await store.load()
    expect(store.error).toBe('sem conexão')
    expect(store.loaded).toBe(false)
  })
})
