import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api'
import { ApiError, errorMessage } from '@/api/client'
import type { Settings } from '@/api/types'
import { useProfileStore } from './profile'
import { useReviewsStore } from './reviews'
import { useUiStore } from './ui'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  /** Erros de validação por campo (422) do último salvamento. */
  const fieldErrors = ref<Record<string, string[]>>({})

  async function load() {
    loading.value = true
    error.value = null
    try {
      settings.value = await api.settings()
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      loading.value = false
    }
  }

  async function save(patch: Partial<Settings>): Promise<boolean> {
    saving.value = true
    fieldErrors.value = {}
    try {
      settings.value = await api.updateSettings(patch)
      // streak, meta semanal e a fila de revisões dependem do fuso/meta
      await Promise.all([useProfileStore().load(), useReviewsStore().refreshDueCount()])
      useUiStore().pushToast('Configurações salvas.', 'success')
      return true
    } catch (e) {
      if (e instanceof ApiError && e.errors) fieldErrors.value = e.errors
      useUiStore().pushToast(errorMessage(e), 'error', 6000)
      return false
    } finally {
      saving.value = false
    }
  }

  return { settings, loading, saving, error, fieldErrors, load, save }
})
