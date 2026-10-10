/** Usuário logado (Supabase Auth). */
export interface AuthUser {
  id: string
  email: string | null
}

/** Erro "cru" de uma chamada RPC (PostgREST/supabase-js ou PGlite), antes de virar ApiError. */
export interface RpcError {
  message: string
  /** SQLSTATE ou código do PostgREST. `PTnnn` = status HTTP nnn definido pelas funções SQL. */
  code?: string | null
  /** Código de máquina definido pelas funções SQL (ex.: checklist_incomplete). */
  hint?: string | null
  /** JSON (texto) com os erros por campo. */
  details?: string | null
  /** Status HTTP, quando conhecido (0 = sem conexão). */
  status?: number
}

export interface BackendAuth {
  /** Usuário da sessão atual, ou null se não há sessão. */
  getUser(): Promise<AuthUser | null>
  /** Avisa mudanças de sessão (login, logout, expiração). Devolve a função que cancela a assinatura. */
  onChange(listener: (user: AuthUser | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  /** `needsConfirmation`: o projeto exige confirmar o e-mail antes de entrar. */
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>
  signOut(): Promise<void>
}

/**
 * Tudo que o app precisa do "servidor": chamadas RPC (funções SQL do Postgres) e autenticação.
 * Há duas implementações com o MESMO SQL por trás: Supabase (produção) e PGlite no navegador (modo demo/testes).
 */
export interface Backend {
  mode: 'supabase' | 'local'
  /** Chama a função `public.<fn>` do banco. Lança ApiError em caso de falha. */
  rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T>
  auth: BackendAuth
}
