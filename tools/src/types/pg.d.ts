// Tipos mínimos do pacote "pg" (só o que src/db/cli.ts usa).
// Se instalar @types/pg (npm i -D @types/pg), apague este arquivo.
declare module 'pg' {
  export interface QueryResult<T = Record<string, unknown>> {
    rows: T[]
  }
  export interface ClientConfig {
    connectionString?: string
    ssl?: boolean | { rejectUnauthorized: boolean }
  }
  export class Client {
    constructor(config?: ClientConfig)
    connect(): Promise<void>
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>
    end(): Promise<void>
  }
  const pg: { Client: typeof Client }
  export default pg
}
