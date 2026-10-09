import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api'
import { ApiError, errorMessage, getToken, setToken } from '@/api/client'

/** Login opcional: só é exigido se o back-end foi iniciado com AUTH_PASSWORD. */
export const useAuthStore = defineStore('auth', () => {
  /** `null` = ainda não consultado. */
  const required = ref<boolean | null>(null)
  const token = ref<string | null>(getToken())
  const error = ref<string | null>(null)
  const loading = ref(false)

  const authenticated = computed(() => required.value === false || token.value !== null)

  async function init() {
    if (required.value !== null) return
    try {
      required.value = (await api.authStatus()).required
    } catch {
      // API fora do ar: as telas mostram o erro de conexão; não bloqueia a navegação
      required.value = false
    }
  }

  async function login(password: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const result = await api.login(password)
      token.value = result.token
      setToken(result.token)
      return true
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : errorMessage(e)
      return false
    } finally {
      loading.value = false
    }
  }

  function logout() {
    token.value = null
    setToken(null)
  }

  /** Chamado quando a API recusa o token (expirou ou senha trocada). */
  function expire() {
    token.value = null
  }

  return { required, token, error, loading, authenticated, init, login, logout, expire }
})
