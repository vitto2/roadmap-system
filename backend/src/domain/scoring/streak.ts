import { addDays, startOfWeek } from './dates'

export interface StreakInfo {
  current: number
  longest: number
  studiedToday: boolean
}

/**
 * Streak diário a partir das datas locais com sessão. A sequência atual continua
 * "viva" se o último dia estudado foi hoje ou ontem. Quebrar o streak não afeta o XP.
 */
export function computeStreak(studiedDates: readonly string[], today: string): StreakInfo {
  const days = new Set(studiedDates)
  const studiedToday = days.has(today)

  let current = 0
  let cursor = studiedToday ? today : addDays(today, -1)
  while (days.has(cursor)) {
    current += 1
    cursor = addDays(cursor, -1)
  }

  let longest = 0
  const sorted = [...days].sort()
  let run = 0
  let previous: string | null = null
  for (const day of sorted) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = day
  }

  return { current, longest, studiedToday }
}

/** Número de sessões (não de dias) na semana (segunda a domingo) que contém `today`. */
export function sessionsInWeek(sessionDates: readonly string[], today: string): number {
  const start = startOfWeek(today)
  const end = addDays(start, 6)
  return sessionDates.filter((d) => d >= start && d <= end).length
}
