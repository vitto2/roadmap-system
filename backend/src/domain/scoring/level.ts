export interface LevelInfo {
  level: number
  /** XP acumulado dentro do nível atual. */
  xpIntoLevel: number
  /** XP total necessário para completar o nível atual (e ir ao próximo). */
  xpForNextLevel: number
  progressPercent: number
}

/** XP necessário para completar o nível N: 100 x N^1.5 (arredondado). */
export function xpToCompleteLevel(level: number): number {
  return Math.round(100 * level ** 1.5)
}

/** Nível de gamificação a partir do XP total. Começa no nível 1. */
export function levelForXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp))
  let level = 1
  let remaining = xp
  while (remaining >= xpToCompleteLevel(level)) {
    remaining -= xpToCompleteLevel(level)
    level += 1
  }
  const xpForNextLevel = xpToCompleteLevel(level)
  return {
    level,
    xpIntoLevel: remaining,
    xpForNextLevel,
    progressPercent: Math.floor((remaining / xpForNextLevel) * 100),
  }
}
