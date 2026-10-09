import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api'
import { errorMessage } from '@/api/client'
import type { Review, ReviewScope } from '@/api/types'
import { useProfileStore } from './profile'
import { useUiStore } from './ui'

export const useReviewsStore = defineStore('reviews', () => {
  const scope = ref<ReviewScope>('today')
  const items = ref<Review[]>([])
  /** Revisões vencidas ou de hoje (para o contador do menu), independente da aba aberta. */
  const dueCount = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const busyId = ref<number | null>(null)

  const overdueCount = computed(() => items.value.filter((r) => r.overdue).length)

  async function refreshDueCount() {
    try {
      dueCount.value = (await api.reviews('today')).length
    } catch {
      // o contador é opcional; falhas aparecem na página de revisões
    }
  }

  async function load(next: ReviewScope = scope.value) {
    scope.value = next
    loading.value = true
    error.value = null
    try {
      items.value = await api.reviews(next)
      if (next === 'today') dueCount.value = items.value.length
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      loading.value = false
    }
  }

  async function run(id: number, action: () => ReturnType<typeof api.completeReview>) {
    busyId.value = id
    try {
      const result = await action()
      useProfileStore().apply(result.profile)
      await load()
      await refreshDueCount()
      return true
    } catch (e) {
      useUiStore().pushToast(errorMessage(e), 'error', 6000)
      return false
    } finally {
      busyId.value = null
    }
  }

  const complete = (id: number) => run(id, () => api.completeReview(id))
  const undo = (id: number) => run(id, () => api.undoReview(id))

  return {
    scope,
    items,
    dueCount,
    overdueCount,
    loading,
    error,
    busyId,
    load,
    refreshDueCount,
    complete,
    undo,
  }
})
