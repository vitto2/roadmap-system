import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api'
import { errorMessage } from '@/api/client'
import type { Profile, StudySession, StudySessionInput } from '@/api/types'
import { useProfileStore } from './profile'
import { useUiStore } from './ui'

const PER_PAGE = 20

export const useJournalStore = defineStore('journal', () => {
  const sessions = ref<StudySession[]>([])
  const total = ref(0)
  const page = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const saving = ref(false)

  const hasMore = computed(() => sessions.value.length < total.value)

  async function load(reset = true) {
    loading.value = true
    error.value = null
    try {
      const nextPage = reset ? 1 : page.value + 1
      const result = await api.sessions(nextPage, PER_PAGE)
      sessions.value = reset ? result.data : [...sessions.value, ...result.data]
      total.value = result.meta.total
      page.value = nextPage
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      loading.value = false
    }
  }

  const loadMore = () => load(false)

  /** Executa uma mutação mostrando o erro como toast. Devolve `true` em caso de sucesso. */
  async function mutate(action: () => Promise<{ profile: Profile }>) {
    saving.value = true
    try {
      useProfileStore().apply((await action()).profile)
      await load()
      return true
    } catch (e) {
      useUiStore().pushToast(errorMessage(e), 'error', 6000)
      return false
    } finally {
      saving.value = false
    }
  }

  const create = (input: StudySessionInput) => mutate(() => api.createSession(input))
  const update = (id: number, input: StudySessionInput) =>
    mutate(() => api.updateSession(id, input))
  const remove = (id: number) => mutate(() => api.deleteSession(id))

  return {
    sessions,
    total,
    loading,
    error,
    saving,
    hasMore,
    load,
    loadMore,
    create,
    update,
    remove,
  }
})
