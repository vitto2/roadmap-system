export const XP_PER_DIFFICULTY = 10
export const REVIEW_XP_RATIO = 0.25
export const PROJECT_FINISH_BONUS = 100
export const PROJECT_REPOSITORY_BONUS = 50
export const PROJECT_DEPLOY_BONUS = 50

/** XP de um tópico concluído: dificuldade x 10. */
export function topicXp(difficulty: number): number {
  return difficulty * XP_PER_DIFFICULTY
}

/** XP de uma revisão concluída: 25% do XP do tópico (arredondado). */
export function reviewXp(difficulty: number): number {
  return Math.round(topicXp(difficulty) * REVIEW_XP_RATIO)
}

export interface ProjectLinks {
  hasRepository: boolean
  hasDeploy: boolean
}

/** Bônus de projeto finalizado: 100 + 50 (repositório) + 50 (deploy). */
export function projectBonusXp({ hasRepository, hasDeploy }: ProjectLinks): number {
  return (
    PROJECT_FINISH_BONUS +
    (hasRepository ? PROJECT_REPOSITORY_BONUS : 0) +
    (hasDeploy ? PROJECT_DEPLOY_BONUS : 0)
  )
}
