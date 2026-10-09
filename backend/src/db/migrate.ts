import { config } from '../config'
import { createDb, runMigrations } from './client'

const handle = createDb(config.databasePath)
runMigrations(handle.db)
handle.close()
console.log(`Migrations aplicadas em ${config.databasePath}`)
