import type { Backend } from './types'

/**
 * Substitui ./local nos builds de produção (ver vite.config.ts) para o PGlite — o Postgres em WebAssembly
 * do modo demo, com ~16 MB — nunca ir para o site publicado.
 */
export function createLocalBackend(_options?: { persist?: boolean }): Promise<Backend> {
  return Promise.reject(new Error('O modo demo não está incluído neste build.'))
}
