import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api'
import { errorMessage } from '@/api/client'
import type { Profile } from '@/api/types'
import { formatNumber } from '@/lib/labels'
import { useUiStore } from './ui'

export const useProfileStore = defineStore('profile', () => {
  const profile = ref<Profile | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      profile.value = await api.profile()
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      loading.value = false
    }
  }

  /**
   * Aplica o perfil recalculado pelo servidor após uma mutação.
   * Devolve a variação de XP (apenas diferença entre dois valores do servidor, para exibição).
   */
  function apply(next: Profile): number {
    const delta = profile.value ? next.xp.total - profile.value.xp.total : 0
    const levelBefore = profile.value?.xp.level
    profile.value = next
    const ui = useUiStore()
    if (delta > 0) ui.pushToast(`+${formatNumber(delta)} XP`, 'success')
    else if (delta < 0) ui.pushToast(`${formatNumber(delta)} XP`, 'info')
    if (levelBefore !== undefined && next.xp.level > levelBefore) {
      ui.pushToast(`Você chegou ao nível ${next.xp.level}!`, 'success', 5000)
    }
    return delta
  }

  return { profile, loading, error, load, apply }
})
