import { allPrerequisites, type SeedContent } from './files'

/** Documento JSON entregue a app.sync_content (supabase/migrations/..._content_sync.sql). */
export interface ContentPayload {
  tracks: {
    slug: string
    title: string
    description: string
    required: boolean
    position: number
  }[]
  topics: {
    track: string
    slug: string
    title: string
    description: string
    level: string
    difficulty: number
    position: number
    prerequisites: string[]
    resources: { name: string; url?: string }[]
    checklist: { key: string; text: string }[]
  }[]
  projects: {
    slug: string
    title: string
    description: string
    level: string
    difficulty: number
    position: number
    topics: string[]
    milestones: { key: string; title: string; acceptanceCriteria: string[]; xp: number }[]
  }[]
}

/**
 * Converte o conteúdo lido dos JSON no payload do banco. As posições vêm da ordem dos arquivos;
 * pré-requisitos entre trilhas (cross-prerequisites.json) já vêm mesclados em cada tópico.
 */
export function buildPayload(content: SeedContent): ContentPayload {
  return {
    tracks: content.tracks.map((t, position) => ({
      slug: t.slug,
      title: t.title,
      description: t.description,
      required: t.required,
      position,
    })),
    topics: [...content.topics.entries()].flatMap(([track, list]) =>
      list.map((t, position) => ({
        track,
        slug: t.slug,
        title: t.title,
        description: t.description,
        level: t.level,
        difficulty: t.difficulty,
        position,
        prerequisites: allPrerequisites(content, t),
        resources: t.resources.map((r) =>
          r.url ? { name: r.name, url: r.url } : { name: r.name },
        ),
        checklist: t.checklist.map((c) => ({ key: c.key, text: c.text })),
      })),
    ),
    projects: content.projects.map((p, position) => ({
      slug: p.slug,
      title: p.title,
      description: p.description,
      level: p.level,
      difficulty: p.difficulty,
      position,
      topics: p.topics,
      milestones: p.milestones.map((m) => ({
        key: m.key,
        title: m.title,
        acceptanceCriteria: m.acceptanceCriteria,
        xp: m.xp,
      })),
    })),
  }
}

const TAG = '$content$'

/** Conteúdo do supabase/seed.sql (idempotente): uma chamada a app.sync_content com o JSON inline. */
export function renderSeedSql(payload: ContentPayload): string {
  const json = JSON.stringify(payload)
  if (json.includes(TAG)) {
    throw new Error(`O conteúdo contém a sequência reservada ${TAG}; remova-a dos JSON.`)
  }
  return [
    '-- Gerado por `npm run content:build` (pasta tools/) a partir de content/*.json. NÃO edite à mão.',
    '-- Idempotente: pode rodar quantas vezes quiser. Carrega/atualiza trilhas, tópicos e projetos; itens que',
    '-- sumirem do conteúdo são arquivados (archived_at) e o seu progresso nunca é apagado.',
    `select app.sync_content(${TAG}${json}${TAG}::jsonb);`,
    '',
  ].join('\n')
}
