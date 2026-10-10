/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL do projeto Supabase (https://<ref>.supabase.co). */
  readonly VITE_SUPABASE_URL?: string
  /** Chave pública (anon / publishable) do projeto. Pode ir no front-end: a segurança é feita por RLS. */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** `local` = modo demo (SQL no navegador via PGlite, sem Supabase). */
  readonly VITE_DATA_MODE?: 'supabase' | 'local'
  /** `false` esconde "Criar conta" na tela de login. */
  readonly VITE_ALLOW_SIGNUP?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
