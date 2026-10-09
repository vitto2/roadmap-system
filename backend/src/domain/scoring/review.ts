import { addDays } from './dates'

export const REVIEW_INTERVALS = [7, 30, 90] as const
export const MASTERED_REVIEW_INTERVALS = [90] as const

export interface ScheduledReview {
  intervalDays: number
  dueOn: string
}

/**
 * Agenda as revisões espaçadas a partir da data (local) de conclusão.
 * Ao marcar "Já domino" agenda só a de 90 dias, para evitar avalanche de revisões.
 */
export function scheduleReviews(completedOn: string, mastered: boolean): ScheduledReview[] {
  const intervals = mastered ? MASTERED_REVIEW_INTERVALS : REVIEW_INTERVALS
  return intervals.map((intervalDays) => ({
    intervalDays,
    dueOn: addDays(completedOn, intervalDays),
  }))
}
