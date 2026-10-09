import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api'
import { errorMessage } from '@/api/client'
import type { CareerLevel, TopicStatus, TopicSummary, TrackSummary } from '@/api/types'

export const useRoadmapStore = defineStore('roadmap', () => {
  const tracks = ref<TrackSummary[]>([])
  const topics = ref<TopicSummary[]>([])
  const loaded = ref(false)
  const stale = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const levelFilter = ref<CareerLevel | null>(null)
  const statusFilter = ref<TopicStatus | null>(null)

  const hasActiveFilters = computed(() => levelFilter.value !== null || statusFilter.value !== null)

  function matches(topic: TopicSummary): boolean {
    return (
      (levelFilter.value === null || topic.careerLevel === levelFilter.value) &&
      (statusFilter.value === null || topic.status === statusFilter.value)
    )
  }

  /** Tópicos (já filtrados) agrupados por slug de trilha. */
  const filteredByTrack = computed(() => {
    const map = new Map<string, TopicSummary[]>()
    for (const topic of topics.value) {
      if (!matches(topic)) continue
      const list = map.get(topic.trackSlug) ?? []
      list.push(topic)
      map.set(topic.trackSlug, list)
    }
    return map
  })

  async function load() {
    loading.value = true
    error.value = null
    try {
      const [t, list] = await Promise.all([api.tracks(), api.topics()])
      tracks.value = t
      topics.value = list
      loaded.value = true
      stale.value = false
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      loading.value = false
    }
  }

  /** Carrega na primeira vez ou quando alguma mutação invalidou os dados. */
  async function ensureLoaded() {
    if (!loaded.value || stale.value) await load()
  }

  function invalidate() {
    stale.value = true
  }

  function setLevelFilter(level: CareerLevel | null) {
    levelFilter.value = level
  }

  function setStatusFilter(status: TopicStatus | null) {
    statusFilter.value = status
  }

  function clearFilters() {
    levelFilter.value = null
    statusFilter.value = null
  }

  return {
    tracks,
    topics,
    loaded,
    stale,
    loading,
    error,
    levelFilter,
    statusFilter,
    hasActiveFilters,
    filteredByTrack,
    load,
    ensureLoaded,
    invalidate,
    setLevelFilter,
    setStatusFilter,
    clearFilters,
  }
})
