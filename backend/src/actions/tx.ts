import type { AppContext } from '../context'
import type { Db } from '../db/client'

/**
 * Executa `fn` numa transação. O `tx` do Drizzle expõe a mesma API de consulta do `Db`,
 * então reaproveitamos o contexto trocando apenas a conexão.
 */
export function inTransaction<T>(ctx: AppContext, fn: (ctx: AppContext) => T): T {
  return ctx.db.transaction((tx) => fn({ ...ctx, db: tx as unknown as Db }))
}
