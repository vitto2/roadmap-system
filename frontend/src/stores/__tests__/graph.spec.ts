import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { GraphNode, TopicGraph } from '@/api/types'
import { useGraphStore } from '../graph'

vi.mock('@/api')
import { api } from '@/api'

function node(slug: string, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    slug,
    title: slug.toUpperCase(),
    trackSlug: 'trilha-a',
    trackTitle: 'Trilha A',
    careerLevel: 'junior',
    difficulty: 2,
    status: 'not_started',
    unlocked: true,
    blockedBy: [],
    ...overrides,
  }
}

const graph: TopicGraph = {
  nodes: [
    node('a', { status: 'completed' }),
    node('b'),
    node('c', { unlocked: false, blockedBy: ['b'] }),
    node('x', { trackSlug: 'trilha-b', trackTitle: 'Trilha B' }),
  ],
  edges: [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
    { source: 'a', target: 'x' },
  ],
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.mocked(api.graph).mockResolvedValue(graph)
})

describe('graph store', () => {
  it('começa pela primeira trilha e permite ver todas', async () => {
    const store = useGraphStore()
    await store.load()
    expect(store.tracks.map((t) => t.slug)).toEqual(['trilha-a', 'trilha-b'])
    expect(store.trackFilter).toBe('trilha-a')
    expect(store.visibleNodes.map((n) => n.slug)).toEqual(['a', 'b', 'c'])

    store.trackFilter = ''
    await store.load() // recarregar não volta a forçar a primeira trilha
    expect(store.trackFilter).toBe('')
    expect(store.visibleNodes).toHaveLength(4)
  })

  it('só mostra arestas entre nós visíveis', async () => {
    const store = useGraphStore()
    await store.load()
    expect(store.visibleEdges).toEqual([
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ])
  })

  it('sugere como próximos passos os tópicos desbloqueados e não concluídos', async () => {
    const store = useGraphStore()
    await store.load()
    expect(store.nextSteps.map((n) => n.slug)).toEqual(['b'])
  })

  it('guarda o erro quando a API falha', async () => {
    vi.mocked(api.graph).mockRejectedValue(new Error('sem rede'))
    const store = useGraphStore()
    await store.load()
    expect(store.error).toBe('sem rede')
    expect(store.graph).toBeNull()
  })
})
