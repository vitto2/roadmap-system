import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // PGlite sobe um Postgres em WebAssembly: a primeira carga é mais lenta
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
})
