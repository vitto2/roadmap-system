import type { AppContext } from '../context'
import { topicPrerequisites } from '../db/schema'
import type { GraphDto } from '../dto'
import { loadTopicRows } from './topics'

/**
 * Grafo de pré-requisitos dos tópicos ativos. Um tópico está "desbloqueado" quando todos os seus
 * pré-requisitos foram concluídos; "bloqueado" é só uma recomendação visual (nunca impede marcar).
 */
export function buildGraph(ctx: AppContext): GraphDto {
  const rows = loadTopicRows(ctx)
  const byId = new Map(rows.map((r) => [r.id, r]))

  const edges = ctx.db
    .select()
    .from(topicPrerequisites)
    .all()
    .flatMap((e) => {
      const source = byId.get(e.prerequisiteId)
      const target = byId.get(e.topicId)
      return source && target ? [{ source: source.slug, target: target.slug }] : []
    })

  const blockedBy = new Map<string, string[]>()
  for (const edge of edges) {
    const source = rows.find((r) => r.slug === edge.source)!
    if (source.status !== 'completed') {
      blockedBy.set(edge.target, [...(blockedBy.get(edge.target) ?? []), edge.source])
    }
  }

  return {
    nodes: rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      trackSlug: r.trackSlug,
      trackTitle: r.trackTitle,
      careerLevel: r.careerLevel,
      difficulty: r.difficulty,
      status: r.status,
      unlocked: !blockedBy.has(r.slug),
      blockedBy: blockedBy.get(r.slug) ?? [],
    })),
    edges,
  }
}
