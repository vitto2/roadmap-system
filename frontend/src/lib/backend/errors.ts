import type { RpcError } from '@/lib/backend/types'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly errors?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** Primeira mensagem de erro de um campo (para exibir em formulários). */
  fieldError(field: string): string | undefined {
    return this.errors?.[field]?.[0]
  }
}

function parseFieldErrors(
  details: string | null | undefined,
): Record<string, string[]> | undefined {
  if (!details) return undefined
  try {
    const parsed: unknown = JSON.parse(details)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
    const errors: Record<string, string[]> = {}
    for (const [field, messages] of Object.entries(parsed)) {
      if (Array.isArray(messages)) errors[field] = messages.filter((m) => typeof m === 'string')
    }
    return Object.keys(errors).length > 0 ? errors : undefined
  } catch {
    return undefined
  }
}

/**
 * Converte o erro de uma chamada RPC no formato do app. As funções SQL levantam SQLSTATE `PTnnn`
 * (nnn = status HTTP), com o código de máquina em `hint` e os erros por campo (JSON) em `details`.
 */
export function toApiError(error: RpcError): ApiError {
  const ptStatus = /^PT(\d{3})$/.exec(error.code ?? '')?.[1]
  if (ptStatus) {
    return new ApiError(
      Number(ptStatus),
      error.hint || 'error',
      error.message,
      parseFieldErrors(error.details),
    )
  }

  const status = error.status ?? 0
  const message = error.message ?? ''
  if (status === 0 && /fetch|network|failed to connect|conex/i.test(message)) {
    return new ApiError(
      0,
      'network_error',
      'Não foi possível conectar ao Supabase. Verifique sua internet e a URL do projeto.',
    )
  }
  if (
    status === 401 ||
    error.code === 'PGRST301' ||
    error.code === 'PGRST303' ||
    /jwt/i.test(message)
  ) {
    return new ApiError(401, 'unauthenticated', 'Sua sessão expirou. Entre novamente.')
  }
  if (error.code === 'PGRST202' || error.code === '42883') {
    return new ApiError(
      404,
      'database_not_ready',
      'O banco ainda não foi preparado. Aplique as migrations e o seed (veja o README).',
    )
  }
  if (status === 403 || error.code === '42501') {
    return new ApiError(403, 'forbidden', 'Sem permissão para esta ação.')
  }
  return new ApiError(status || 500, 'server_error', message || 'Erro inesperado no servidor.')
}

/** Mensagem amigável para qualquer erro capturado. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Ocorreu um erro inesperado.'
}
