import pg from 'pg'
import { checkSeedIntegrity, checkTrackSizes, readSeedContent } from '../content/files'
import { buildPayload } from '../content/payload'
import { applyMigrations, syncContent, type SqlExecutor } from './apply'
import { listMigrations } from './migrations'

/**
 * Aplica o banco em um Postgres/Supabase de verdade, usando DATABASE_URL (tools/.env).
 *   npm run db:migrate   aplica as migrations pendentes (supabase/migrations)
 *   npm run db:seed      carrega/atualiza o conteúdo (content/*.json) — idempotente
 *   npm run db:setup     migrate + seed
 */
try {
  process.loadEnvFile()
} catch {
  // sem .env: usa as variáveis do ambiente
}

const command = process.argv[2]
if (!['migrate', 'seed', 'setup'].includes(command ?? '')) {
  console.error('Uso: tsx src/db/cli.ts <migrate|seed|setup>')
  process.exit(1)
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Defina DATABASE_URL em tools/.env (veja tools/.env.example).')
  process.exit(1)
}

const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(url)
// O Supabase exige TLS. Aqui o certificado não é verificado (comum em scripts de setup pontuais);
// a conexão continua criptografada.
const client = new pg.Client({
  connectionString: url,
  ssl: isLocal ? false : { rejectUnauthorized: false },
})

const db: SqlExecutor = {
  exec: (sql) => client.query(sql),
  query: (sql, params) => client.query(sql, params),
}

try {
  await client.connect()

  if (command === 'migrate' || command === 'setup') {
    const applied = await applyMigrations(db, listMigrations(), (m) => console.log(m))
    console.log(
      applied.length === 0
        ? 'Banco já está atualizado.'
        : `${applied.length} migration(s) aplicada(s).`,
    )
  }

  if (command === 'seed' || command === 'setup') {
    const content = readSeedContent()
    const problems = [...checkTrackSizes(content), ...checkSeedIntegrity(content)]
    if (problems.length > 0) {
      throw new Error(`Conteúdo inválido:\n - ${problems.join('\n - ')}`)
    }
    const summary = await syncContent(db, buildPayload(content))
    console.log('Conteúdo sincronizado (idempotente):')
    console.log(JSON.stringify(summary, null, 2))
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await client.end()
}
