# Trilha Sênior — front-end

SPA em Vue 3 (`<script setup>`, TypeScript estrito), Vite, Pinia, Vue Router e Tailwind v4.
Veja o [README da raiz](../README.md) para instalação e o [CLAUDE.md](../CLAUDE.md) para convenções.

```bash
npm install
npm run dev          # http://localhost:5173 (proxy /api -> 127.0.0.1:8000)
npm test             # Vitest (stores, composables, componentes)
npm run lint         # oxlint + eslint
npm run format       # prettier
npm run type-check   # vue-tsc
npm run build
```

Estrutura de `src/`: `api/` (cliente tipado e contratos), `stores/` (Pinia), `pages/` (páginas finas),
`components/` (por domínio), `composables/`, `lib/` (rótulos, layout do grafo, download).
O front-end **só exibe** valores calculados pela API: XP, níveis e streak nunca são recalculados aqui.
