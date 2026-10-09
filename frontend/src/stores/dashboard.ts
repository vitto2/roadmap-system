import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api'
import { errorMessage } from '@/api/client'
import type { Dashboard } from '@/api/types'

export const useDashboardStore = defineStore('dashboard', () => {
  const data = ref<Dashboard | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      data.value = await api.dashboard()
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, load }
})
