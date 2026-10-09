import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api'
import { errorMessage } from '@/api/client'
import type { TopicGraph } from '@/api/types'

export const useGraphStore = defineStore('graph', () => {
  const graph = ref<TopicGraph | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** Slug da trilha exibida; vazio = todas. */
  const trackFilter = ref('')
  let trackChosen = false

  const tracks = computed(() => {
    const map = new Map<string, string>()
    for (const n of graph.value?.nodes ?? []) map.set(n.trackSlug, n.trackTitle)
    return [...map.entries()].map(([slug, title]) => ({ slug, title }))
  })

  const visibleNodes = computed(() =>
    (graph.value?.nodes ?? []).filter(
      (n) => !trackFilter.value || n.trackSlug === trackFilter.value,
    ),
  )

  const visibleEdges = computed(() => {
    const slugs = new Set(visibleNodes.value.map((n) => n.slug))
    return (graph.value?.edges ?? []).filter((e) => slugs.has(e.source) && slugs.has(e.target))
  })

  /** Próximos passos: tópicos não concluídos cujos pré-requisitos já foram concluídos. */
  const nextSteps = computed(() =>
    visibleNodes.value.filter((n) => n.status !== 'completed' && n.unlocked).slice(0, 8),
  )

  async function load() {
    loading.value = true
    error.value = null
    try {
      graph.value = await api.graph()
      // Com todas as trilhas o grafo fica ilegível; começa pela primeira (dá para ver "Todas").
      if (!trackChosen && tracks.value.length > 0) {
        trackFilter.value = tracks.value[0]!.slug
        trackChosen = true
      }
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      loading.value = false
    }
  }

  return { graph, loading, error, trackFilter, tracks, visibleNodes, visibleEdges, nextSteps, load }
})
