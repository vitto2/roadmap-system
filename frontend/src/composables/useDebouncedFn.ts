import { onScopeDispose } from 'vue'

/** Debounce com `flush` (executa pendente já) e `cancel`. Limpa o timer ao destruir o escopo. */
export function useDebouncedFn<Args extends unknown[]>(fn: (...args: Args) => void, delay = 800) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: Args | undefined

  function run(...args: Args) {
    pending = args
    clearTimeout(timer)
    timer = setTimeout(flush, delay)
  }

  function flush() {
    clearTimeout(timer)
    timer = undefined
    if (pending) {
      const args = pending
      pending = undefined
      fn(...args)
    }
  }

  function cancel() {
    clearTimeout(timer)
    timer = undefined
    pending = undefined
  }

  onScopeDispose(flush)

  return { run, flush, cancel }
}
