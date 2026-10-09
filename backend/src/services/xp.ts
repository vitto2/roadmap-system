import { eq, isNotNull } from 'drizzle-orm'
import type { AppContext } from '../context'
import { milestoneProgress, milestones, reviews, topicProgress, topics } from '../db/schema'
import { reviewXp, topicXp } from '../domain/scoring'
import { sum } from '../util'
import { loadProjectStates, projectBonus } from './projects'

export interface XpBreakdown {
  topics: number
  milestones: number
  projects: number
  reviews: number
  total: number
}

/**
 * XP total, sempre derivado do estado dos registros (nunca de um contador).
 * Desmarcar/reabrir algo remove o XP correspondente na próxima leitura.
 * O progresso de itens arquivados continua contando (nada some silenciosamente).
 */
export function computeXp(ctx: AppContext): XpBreakdown {
  const { db } = ctx

  const topicsXp = sum(
    db
      .select({ difficulty: topics.difficulty })
      .from(topicProgress)
      .innerJoin(topics, eq(topics.id, topicProgress.topicId))
      .where(eq(topicProgress.status, 'completed'))
      .all()
      .map((r) => topicXp(r.difficulty)),
  )

  const milestonesXp = sum(
    db
      .select({ xp: milestones.xp })
      .from(milestoneProgress)
      .innerJoin(milestones, eq(milestones.id, milestoneProgress.milestoneId))
      .where(eq(milestoneProgress.status, 'completed'))
      .all()
      .map((r) => r.xp),
  )

  const projectsXp = sum(
    loadProjectStates(ctx, { includeArchived: true }).map((p) => projectBonus(p).total),
  )

  const reviewsXp = sum(
    db
      .select({ difficulty: topics.difficulty })
      .from(reviews)
      .innerJoin(topics, eq(topics.id, reviews.topicId))
      .where(isNotNull(reviews.completedAt))
      .all()
      .map((r) => reviewXp(r.difficulty)),
  )

  return {
    topics: topicsXp,
    milestones: milestonesXp,
    projects: projectsXp,
    reviews: reviewsXp,
    total: topicsXp + milestonesXp + projectsXp + reviewsXp,
  }
}
