import { config } from './config'
import { createDb, runMigrations } from './db/client'
import { buildApp } from './http/app'

const handle = createDb(config.databasePath)
runMigrations(handle.db)

const app = buildApp({ db: handle.db, config, now: () => new Date() }, { logger: true })

const shutdown = async () => {
  await app.close()
  handle.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

try {
  await app.listen({ port: config.port, host: '127.0.0.1' })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
