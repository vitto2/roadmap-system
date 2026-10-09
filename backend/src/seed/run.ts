import { config } from '../config'
import { createDb, runMigrations } from '../db/client'
import { defaultSeedDir, readSeedContent } from './files'
import { seedDatabase } from './loader'

const dir = process.argv[2] ?? defaultSeedDir
const handle = createDb(config.databasePath)
runMigrations(handle.db)

const summary = seedDatabase(handle.db, readSeedContent(dir))
handle.close()

console.log('Seed aplicado (idempotente):')
console.log(JSON.stringify(summary, null, 2))
