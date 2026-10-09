export const CAREER_LEVELS = ['beginner', 'junior', 'mid', 'senior'] as const
export type CareerLevel = (typeof CAREER_LEVELS)[number]

/** Porcentagem mínima de progresso (trilhas obrigatórias) para cada nível. */
export const CAREER_THRESHOLDS: Record<Exclude<CareerLevel, 'beginner'>, number> = {
  junior: 40,
  mid: 60,
  senior: 80,
}

export interface TopicLike {
  careerLevel: CareerLevel
  completed: boolean
}

export interface CareerLevelProgress {
  level: Exclude<CareerLevel, 'beginner'>
  requiredPercent: number
  percent: number
  reached: boolean
}

export interface CareerEvaluation {
  level: CareerLevel
  next: CareerLevelProgress | null
  progress: CareerLevelProgress[]
}

export function careerRank(level: CareerLevel): number {
  return CAREER_LEVELS.indexOf(level)
}

/**
 * Nível de carreira atual. Para cada nível-alvo L, considera os tópicos das trilhas
 * obrigatórias com nível <= L; o nível é atingido quando a % concluída >= mínimo.
 * Os níveis são sequenciais: só vale o nível se os anteriores também foram atingidos.
 */
export function evaluateCareerLevel(
  topics: readonly TopicLike[],
  thresholds: Record<Exclude<CareerLevel, 'beginner'>, number> = CAREER_THRESHOLDS,
): CareerEvaluation {
  const targets = ['junior', 'mid', 'senior'] as const
  const progress: CareerLevelProgress[] = []
  let current: CareerLevel = 'beginner'
  let blocked = false

  for (const target of targets) {
    const scope = topics.filter((t) => careerRank(t.careerLevel) <= careerRank(target))
    const done = scope.filter((t) => t.completed).length
    const percent = scope.length === 0 ? 0 : Math.floor((done / scope.length) * 100)
    const requiredPercent = thresholds[target]
    const reached = !blocked && scope.length > 0 && percent >= requiredPercent
    if (reached) current = target
    else blocked = true
    progress.push({ level: target, requiredPercent, percent, reached })
  }

  return { level: current, next: progress.find((p) => !p.reached) ?? null, progress }
}
