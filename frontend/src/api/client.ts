import { getBackend } from '@/lib/backend'

export { ApiError, errorMessage, toApiError } from '@/lib/backend/errors'

/** Chama uma função RPC do banco (public.<fn>). Lança ApiError em caso de falha. */
export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const backend = await getBackend()
  return backend.rpc<T>(fn, args)
}
