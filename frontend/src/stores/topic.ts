import { ref, toRaw } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api'
import { ApiError, errorMessage } from '@/api/client'
import type { Mutation, TopicDetail } from '@/api/types'
import { useProfileStore } from './profile'
import { useRoadmapStore } from './roadmap'
import { useUiStore } from './ui'

export const useTopicStore = defineStore('topic', () => {
  const current = ref<TopicDetail | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const notFound = ref(false)
  /** Mutação em andamento (desabilita botões de ação). */
  const busy = ref(false)

  async function load(slug: string) {
    if (current.value?.slug !== slug) current.value = null
    loading.value = true
    error.value = null
    notFound.value = false
    try {
      current.value = await api.topic(slug)
    } catch (e) {
      error.value = errorMessage(e)
      notFound.value = e instanceof ApiError && e.status === 404
    } finally {
      loading.value = false
    }
  }

  function applyMutation(result: Mutation<TopicDetail>) {
    current.value = result.data
    useProfileStore().apply(result.profile)
    useRoadmapStore().invalidate()
  }

  /** Executa uma mutação mostrando erros como toast; devolve true em caso de sucesso. */
  async function mutate(action: () => Promise<Mutation<TopicDetail>>): Promise<boolean> {
    busy.value = true
    try {
      applyMutation(await action())
      return true
    } catch (e) {
      useUiStore().pushToast(errorMessage(e), 'error', 6000)
      return false
    } finally {
      busy.value = false
    }
  }

  /** Marca/desmarca com atualização otimista e rollback se o servidor recusar. */
  async function toggleItem(key: string, checked: boolean) {
    const topic = current.value
    if (!topic) return
    const snapshot = structuredClone(toRaw(topic))
    const item = topic.checklist.find((i) => i.key === key)
    if (!item || item.checked === checked) return
    item.checked = checked
    topic.checklistChecked += checked ? 1 : -1

    const ok = await mutate(() => api.setChecklistItem(topic.slug, key, checked))
    if (!ok) current.value = snapshot
  }

  const complete = () => requireTopic((slug) => mutate(() => api.completeTopic(slug)))
  const master = () => requireTopic((slug) => mutate(() => api.masterTopic(slug)))
  const reopen = () => requireTopic((slug) => mutate(() => api.reopenTopic(slug)))

  const setStatus = (status: 'not_started' | 'studying') =>
    requireTopic((slug) => mutate(() => api.updateTopicProgress(slug, { status })))

  const saveNotes = (notes: string) =>
    requireTopic((slug) => mutate(() => api.updateTopicProgress(slug, { notes })))

  const saveEvidence = (evidenceUrl: string | null) =>
    requireTopic((slug) => mutate(() => api.updateTopicProgress(slug, { evidenceUrl })))

  async function requireTopic(fn: (slug: string) => Promise<boolean>): Promise<boolean> {
    return current.value ? fn(current.value.slug) : false
  }

  return {
    current,
    loading,
    error,
    notFound,
    busy,
    load,
    toggleItem,
    complete,
    master,
    reopen,
    setStatus,
    saveNotes,
    saveEvidence,
  }
})
