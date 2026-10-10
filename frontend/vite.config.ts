import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

const src = fileURLToPath(new URL('./src', import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Publicação em subpasta (ex.: GitHub Pages: VITE_BASE=/nome-do-repo/). Padrão: raiz do domínio.
  base: process.env.VITE_BASE || '/',
  plugins: [vue(), tailwindcss(), vueDevTools()],
  // Tailwind v4 roda pelo plugin do Vite. Declarar `postcss` aqui evita que o Vite procure (e quebre
  // com) algum postcss.config.* esquecido em pastas acima do projeto.
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: [
      // Build de produção: o modo demo (PGlite, ~16 MB) é trocado por um stub e fica fora do site publicado.
      ...(mode === 'production'
        ? [{ find: '@/lib/backend/local', replacement: `${src}/lib/backend/local.stub.ts` }]
        : []),
      { find: '@', replacement: src },
    ],
  },
  // PGlite (Postgres em WebAssembly, só no modo demo) não deve ser pré-empacotado pelo Vite.
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  server: {
    port: 5173,
    // O modo demo lê o SQL de ../supabase (migrations + seed) com import.meta.glob.
    fs: { allow: ['..'] },
  },
}))
