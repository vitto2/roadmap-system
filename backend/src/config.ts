import { resolve } from 'node:path'

try {
  process.loadEnvFile()
} catch {
  // sem .env: usa os padrões abaixo
}

const env = process.env

export const config = {
  port: Number(env.PORT ?? 8000),
  databasePath: resolve(env.DATABASE_PATH ?? 'data/trilha.sqlite'),
  timezone: env.APP_TIMEZONE ?? 'America/Sao_Paulo',
  weeklyGoal: Number(env.WEEKLY_GOAL ?? 5),
  corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
  authPassword: env.AUTH_PASSWORD || null,
  authSecret: env.AUTH_SECRET || null,
}

export type AppConfig = typeof config
