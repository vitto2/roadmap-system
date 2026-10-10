# Trilha Sênior — front-end

SPA em Vue 3 (`<script setup>`, TypeScript estrito), Vite, Pinia, Vue Router e Tailwind v4, que conversa direto com o
Supabase (login + funções SQL). Veja o [README da raiz](../README.md) para o passo a passo completo e o
[CLAUDE.md](../CLAUDE.md) para as decisões de arquitetura.

```bash
npm install
cp .env.example .env   # VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev            # http://localhost:5173
npm run dev:demo       # sem Supabase: o mesmo SQL roda no navegador (PGlite)
npm test               # Vitest
npm run lint           # oxlint + eslint
npm run format         # prettier
npm run type-check     # vue-tsc
npm run build          # site estático em dist/
```

Estrutura de `src/`: `lib/backend/` (Supabase e modo demo atrás da mesma interface), `api/` (uma função por RPC do banco e
tipos do JSON), `stores/` (Pinia), `pages/` (páginas finas), `components/` (por domínio), `composables/`, `lib/` (rótulos,
layout do grafo, portfólio em markdown, download).

O front-end **só exibe** valores calculados no servidor: XP, níveis e streak nunca são recalculados aqui.
