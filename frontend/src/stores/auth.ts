import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { errorMessage } from '@/api/client'
import { getBackend, type AuthUser } from '@/lib/backend'

/** Sessão do Supabase Auth (e-mail + senha). Cada usuário só enxerga o próprio progresso (RLS no banco). */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  /** `false` até a sessão salva (se houver) ser lida. */
  const ready = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** Aviso (ex.: "confirme seu e-mail") exibido na tela de login. */
  const notice = ref<string | null>(null)

  const authenticated = computed(() => user.value !== null)

  let initializing: Promise<void> | undefined

  /** Lê a sessão existente e passa a acompanhar login/logout/expiração. Seguro chamar várias vezes. */
  function init(): Promise<void> {
    initializing ??= (async () => {
      const backend = await getBackend()
      user.value = await backend.auth.getUser()
      backend.auth.onChange((next) => {
        user.value = next
      })
      ready.value = true
    })()
    return initializing
  }

  async function run(
    action: (auth: Awaited<ReturnType<typeof getBackend>>['auth']) => Promise<boolean>,
  ) {
    loading.value = true
    error.value = null
    notice.value = null
    try {
      const backend = await getBackend()
      return await action(backend.auth)
    } catch (e) {
      error.value = errorMessage(e)
      return false
    } finally {
      loading.value = false
    }
  }

  const signIn = (email: string, password: string) =>
    run(async (auth) => {
      await auth.signIn(email.trim(), password)
      user.value = await auth.getUser()
      return true
    })

  const signUp = (email: string, password: string) =>
    run(async (auth) => {
      const { needsConfirmation } = await auth.signUp(email.trim(), password)
      if (needsConfirmation) {
        notice.value =
          'Cadastro criado! Confirme seu e-mail (veja a caixa de entrada) e depois entre.'
        return false
      }
      user.value = await auth.getUser()
      return true
    })

  async function signOut() {
    await run(async (auth) => {
      await auth.signOut()
      user.value = null
      return true
    })
  }

  return { user, ready, loading, error, notice, authenticated, init, signIn, signUp, signOut }
})
