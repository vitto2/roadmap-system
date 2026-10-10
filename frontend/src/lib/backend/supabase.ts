import { createClient, type AuthError, type Session } from '@supabase/supabase-js'
import { ApiError, toApiError } from './errors'
import type { AuthUser, Backend } from './types'

const toUser = (session: Session | null): AuthUser | null =>
  session?.user ? { id: session.user.id, email: session.user.email ?? null } : null

/** Mensagens em português para os erros mais comuns do Supabase Auth. */
export function translateAuthError(
  error: Pick<AuthError, 'code' | 'message' | 'status'>,
): ApiError {
  const code = error.code ?? ''
  const status = error.status ?? 400
  switch (code) {
    case 'invalid_credentials':
      return new ApiError(status, code, 'E-mail ou senha incorretos.')
    case 'email_not_confirmed':
      return new ApiError(
        status,
        code,
        'Confirme seu e-mail (veja a caixa de entrada) antes de entrar.',
      )
    case 'user_already_exists':
    case 'email_exists':
      return new ApiError(status, code, 'Este e-mail já tem cadastro. Use "Entrar".')
    case 'signup_disabled':
      return new ApiError(status, code, 'Novos cadastros estão desativados neste projeto.')
    case 'weak_password':
      return new ApiError(
        status,
        code,
        'Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.',
      )
    case 'validation_failed':
    case 'email_address_invalid':
      return new ApiError(status, code, 'Informe um e-mail válido.')
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return new ApiError(429, code, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.')
    default:
      if (/fetch|network/i.test(error.message)) {
        return new ApiError(
          0,
          'network_error',
          'Não foi possível conectar ao Supabase. Verifique sua internet.',
        )
      }
      if (/password should be at least/i.test(error.message)) {
        return new ApiError(status, 'weak_password', 'A senha precisa ter pelo menos 6 caracteres.')
      }
      return new ApiError(
        status,
        code || 'auth_error',
        'Não foi possível autenticar. Tente novamente.',
      )
  }
}

/** Backend de produção: PostgREST (funções RPC) + Supabase Auth, via supabase-js. */
export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  })

  return {
    mode: 'supabase',

    async rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
      const { data, error, status } = await client.rpc(fn, args)
      if (error) throw toApiError({ ...error, status })
      return data as T
    },

    auth: {
      async getUser() {
        const { data } = await client.auth.getSession()
        return toUser(data.session)
      },

      onChange(listener) {
        const { data } = client.auth.onAuthStateChange((_event, session) =>
          listener(toUser(session)),
        )
        return () => data.subscription.unsubscribe()
      },

      async signIn(email, password) {
        const { error } = await client.auth.signInWithPassword({ email, password })
        if (error) throw translateAuthError(error)
      },

      async signUp(email, password) {
        const { data, error } = await client.auth.signUp({ email, password })
        if (error) throw translateAuthError(error)
        return { needsConfirmation: data.session === null }
      },

      async signOut() {
        const { error } = await client.auth.signOut()
        if (error) throw translateAuthError(error)
      },
    },
  }
}
