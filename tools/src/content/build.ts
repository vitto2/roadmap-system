import { readFileSync, writeFileSync } from 'node:fs'
import { SEED_FILE } from '../paths'
import { checkSeedIntegrity, checkTrackSizes, readSeedContent } from './files'
import { buildPayload, renderSeedSql } from './payload'

/**
 * Gera supabase/seed.sql a partir de content/*.json.
 *   npm run content:build           escreve o arquivo
 *   npm run content:build -- --check  falha se o arquivo estiver desatualizado (usado no CI)
 */
const content = readSeedContent()
const problems = [...checkTrackSizes(content), ...checkSeedIntegrity(content)]
if (problems.length > 0) {
  console.error(`Conteúdo inválido (${problems.length} problema(s)):`)
  for (const p of problems) console.error(` - ${p}`)
  process.exit(1)
}

const sql = renderSeedSql(buildPayload(content))

if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = readFileSync(SEED_FILE, 'utf8')
  } catch {
    // arquivo ausente: tratado como desatualizado
  }
  if (current !== sql) {
    console.error('supabase/seed.sql está desatualizado. Rode: npm run content:build (em tools/)')
    process.exit(1)
  }
  console.log('supabase/seed.sql está atualizado.')
} else {
  writeFileSync(SEED_FILE, sql, 'utf8')
  console.log(`supabase/seed.sql gerado (${Math.round(sql.length / 1024)} KB).`)
}
