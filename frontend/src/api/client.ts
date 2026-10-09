import type { ApiErrorBody } from './types'

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

const BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(
      0,
      'network_error',
      'Não foi possível conectar à API. Verifique se o back-end está rodando.',
    )
  }

  if (!response.ok) {
    let payload: Partial<ApiErrorBody> = {}
    try {
      payload = (await response.json()) as Partial<ApiErrorBody>
    } catch {
      // resposta sem JSON (ex.: proxy fora do ar)
    }
    throw new ApiError(
      response.status,
      payload.code ?? 'http_error',
      payload.message ?? `Erro ${response.status} ao falar com a API.`,
      payload.errors,
    )
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  delete: <T>(path: string) => request<T>('DELETE', path),
}

/** Mensagem amigável para qualquer erro capturado. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Ocorreu um erro inesperado.'
}
