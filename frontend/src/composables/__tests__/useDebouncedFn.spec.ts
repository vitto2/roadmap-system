import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useDebouncedFn } from '../useDebouncedFn'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useDebouncedFn', () => {
  it('executa só a última chamada após o atraso', () => {
    const fn = vi.fn<(value: string) => void>()
    const scope = effectScope()
    const debounced = scope.run(() => useDebouncedFn(fn, 500))!

    debounced.run('a')
    debounced.run('b')
    debounced.run('c')
    vi.advanceTimersByTime(499)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('c')
    scope.stop()
  })

  it('flush executa a chamada pendente imediatamente', () => {
    const fn = vi.fn<(value: string) => void>()
    const scope = effectScope()
    const debounced = scope.run(() => useDebouncedFn(fn, 500))!

    debounced.run('x')
    debounced.flush()
    expect(fn).toHaveBeenCalledWith('x')
    vi.advanceTimersByTime(1000)
    expect(fn).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('cancel descarta a chamada pendente', () => {
    const fn = vi.fn<(value: string) => void>()
    const scope = effectScope()
    const debounced = scope.run(() => useDebouncedFn(fn, 500))!

    debounced.run('x')
    debounced.cancel()
    vi.advanceTimersByTime(1000)
    expect(fn).not.toHaveBeenCalled()
    scope.stop()
  })

  it('descarrega a chamada pendente ao destruir o escopo', () => {
    const fn = vi.fn<(value: string) => void>()
    const scope = effectScope()
    const debounced = scope.run(() => useDebouncedFn(fn, 500))!

    debounced.run('salvar ao sair')
    scope.stop()
    expect(fn).toHaveBeenCalledWith('salvar ao sair')
  })
})
