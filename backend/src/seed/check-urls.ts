import { defaultSeedDir, readSeedContent } from './files'

/**
 * Verifica se os links de recursos do seed ainda respondem (rede necessária).
 * Uso: npm run seed:check-urls
 * Links que bloqueiam bots (403/429) aparecem como "avisos" e não derrubam o script.
 */
const content = readSeedContent(process.argv[2] ?? defaultSeedDir)

const urls = new Map<string, string[]>()
for (const topics of content.topics.values()) {
  for (const topic of topics) {
    for (const resource of topic.resources) {
      if (!resource.url) continue
      urls.set(resource.url, [...(urls.get(resource.url) ?? []), topic.slug])
    }
  }
}

interface Result {
  url: string
  status: number | string
}

async function check(url: string): Promise<Result> {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrilhaSenior-link-check)' },
      signal: AbortSignal.timeout(20_000),
    })
    return { url, status: response.status }
  } catch (error) {
    return { url, status: error instanceof Error ? error.name : 'erro' }
  }
}

async function runPool(items: string[], size: number): Promise<Result[]> {
  const results: Result[] = []
  let next = 0
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const url = items[next++]!
        results.push(await check(url))
      }
    }),
  )
  return results
}

const results = await runPool([...urls.keys()], 8)
const failures = results.filter((r) => typeof r.status !== 'number' || r.status >= 400)
const warnings = failures.filter((r) => r.status === 403 || r.status === 429)
const errors = failures.filter((r) => !warnings.includes(r))

console.log(`${results.length} links verificados`)
for (const r of warnings)
  console.warn(`AVISO ${r.status}  ${r.url}  (${urls.get(r.url)?.join(', ')})`)
for (const r of errors)
  console.error(`FALHA ${r.status}  ${r.url}  (${urls.get(r.url)?.join(', ')})`)
if (errors.length > 0) process.exit(1)
console.log('Links OK')
