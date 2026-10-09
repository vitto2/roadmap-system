import { ref } from 'vue'
import { errorMessage } from '@/api/client'

/**
 * Envolve uma função assíncrona expondo `loading` e `error` (texto pronto para exibir).
 * `run` nunca lança: devolve `undefined` em caso de erro.
 */
export function useAsyncAction<Args extends unknown[], R>(fn: (...args: Args) => Promise<R>) {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function run(...args: Args): Promise<R | undefined> {
    loading.value = true
    error.value = null
    try {
      return await fn(...args)
    } catch (e) {
      error.value = errorMessage(e)
      return undefined
    } finally {
      loading.value = false
    }
  }

  return { loading, error, run }
}
