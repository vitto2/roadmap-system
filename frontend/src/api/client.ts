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
const TOKEN_KEY = 'auth_token'

/** Evento disparado quando a API responde 401 (login opcional ativado no servidor). */
export const AUTH_REQUIRED_EVENT = 'auth:required'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // localStorage indisponível: o token vale só até recarregar
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

async function send(method: Method, path: string, body?: unknown): Promise<Response> {
  const token = getToken()
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    if (response.status === 401 && payload.code === 'unauthenticated') {
      setToken(null)
      window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT))
    }
    throw new ApiError(
      response.status,
      payload.code ?? 'http_error',
      payload.message ?? `Erro ${response.status} ao falar com a API.`,
      payload.errors,
    )
  }
  return response
}

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const response = await send(method, path, body)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** Baixa um arquivo (exportações) mantendo o cabeçalho de autenticação. */
async function download(path: string): Promise<{ blob: Blob; filename: string }> {
  const response = await send('GET', path)
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? 'download'
  return { blob: await response.blob(), filename }
}

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  delete: <T>(path: string) => request<T>('DELETE', path),
  download,
}

/** Mensagem amigável para qualquer erro capturado. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Ocorreu um erro inesperado.'
}
