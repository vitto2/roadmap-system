import type { AppConfig } from './config'
import type { Db } from './db/client'

/** Dependências compartilhadas por actions e services (injetáveis nos testes). */
export interface AppContext {
  db: Db
  config: AppConfig
  now: () => Date
}
