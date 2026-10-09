import { and, asc, eq, isNull } from 'drizzle-orm'
import type { AppContext } from '../context'
import {
  milestoneProgress,
  milestones,
  projectProgress,
  projects,
  projectTopics,
  topics,
  topicProgress,
} from '../db/schema'
import { notFound } from '../errors'
import {
  PROJECT_DEPLOY_BONUS,
  PROJECT_FINISH_BONUS,
  PROJECT_REPOSITORY_BONUS,
  projectBonusXp,
  type CareerLevel,
} from '../domain/scoring'
import type { MilestoneStatus, TopicStatus } from '../domain/status'
import type { ProjectDetail, ProjectSummary } from '../dto'
import { groupBy, sum } from '../util'

export interface MilestoneState {
  id: number
  key: string
  title: string
  acceptanceCriteria: string[]
  xp: number
  position: number
  archived: boolean
  status: MilestoneStatus
  completedAt: string | null
}

export interface ProjectState {
  id: number
  slug: string
  title: string
  description: string
  careerLevel: CareerLevel
  difficulty: number
  archived: boolean
  repositoryUrl: string | null
  deployUrl: string | null
  milestones: MilestoneState[]
  /** Finalizado: todas as etapas ativas concluídas (derivado, nunca armazenado). */
  finished: boolean
  completedMilestoneXp: number
}

function parseCriteria(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Carrega projetos com etapas e progresso. `includeArchived` é usado no cálculo de XP. */
export function loadProjectStates(
  ctx: AppContext,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): ProjectState[] {
  const projectRows = ctx.db
    .select({
      id: projects.id,
      slug: projects.slug,
      title: projects.title,
      description: projects.description,
      careerLevel: projects.careerLevel,
      difficulty: projects.difficulty,
      archivedAt: projects.archivedAt,
      repositoryUrl: projectProgress.repositoryUrl,
      deployUrl: projectProgress.deployUrl,
    })
    .from(projects)
    .leftJoin(projectProgress, eq(projectProgress.projectId, projects.id))
    .where(includeArchived ? undefined : isNull(projects.archivedAt))
    .orderBy(asc(projects.position))
    .all()

  const milestoneRows = ctx.db
    .select({
      id: milestones.id,
      projectId: milestones.projectId,
      key: milestones.key,
      title: milestones.title,
      acceptanceCriteria: milestones.acceptanceCriteria,
      xp: milestones.xp,
      position: milestones.position,
      archivedAt: milestones.archivedAt,
      status: milestoneProgress.status,
      completedAt: milestoneProgress.completedAt,
    })
    .from(milestones)
    .leftJoin(milestoneProgress, eq(milestoneProgress.milestoneId, milestones.id))
    .orderBy(asc(milestones.position))
    .all()
  const byProject = groupBy(milestoneRows, (m) => m.projectId)

  return projectRows.map((p) => {
    const states: MilestoneState[] = (byProject.get(p.id) ?? []).map((m) => ({
      id: m.id,
      key: m.key,
      title: m.title,
      acceptanceCriteria: parseCriteria(m.acceptanceCriteria),
      xp: m.xp,
      position: m.position,
      archived: m.archivedAt !== null,
      status: (m.status ?? 'pending') as MilestoneStatus,
      completedAt: m.completedAt ?? null,
    }))
    const active = states.filter((m) => !m.archived)
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      careerLevel: p.careerLevel as CareerLevel,
      difficulty: p.difficulty,
      archived: p.archivedAt !== null,
      repositoryUrl: p.repositoryUrl ?? null,
      deployUrl: p.deployUrl ?? null,
      milestones: states,
      finished: active.length > 0 && active.every((m) => m.status === 'completed'),
      completedMilestoneXp: sum(states.filter((m) => m.status === 'completed').map((m) => m.xp)),
    }
  })
}

export function projectBonus(state: ProjectState): {
  finished: boolean
  finishXp: number
  repositoryXp: number
  deployXp: number
  total: number
} {
  if (!state.finished)
    return { finished: false, finishXp: 0, repositoryXp: 0, deployXp: 0, total: 0 }
  const hasRepository = Boolean(state.repositoryUrl)
  const hasDeploy = Boolean(state.deployUrl)
  return {
    finished: true,
    finishXp: PROJECT_FINISH_BONUS,
    repositoryXp: hasRepository ? PROJECT_REPOSITORY_BONUS : 0,
    deployXp: hasDeploy ? PROJECT_DEPLOY_BONUS : 0,
    total: projectBonusXp({ hasRepository, hasDeploy }),
  }
}

function toSummary(state: ProjectState): ProjectSummary {
  const active = state.milestones.filter((m) => !m.archived)
  const completed = active.filter((m) => m.status === 'completed').length
  const started =
    completed > 0 ||
    active.some((m) => m.status === 'in_progress') ||
    Boolean(state.repositoryUrl || state.deployUrl)
  return {
    slug: state.slug,
    title: state.title,
    description: state.description,
    careerLevel: state.careerLevel,
    difficulty: state.difficulty,
    status: state.finished ? 'finished' : started ? 'in_progress' : 'not_started',
    milestonesTotal: active.length,
    milestonesCompleted: completed,
    totalXp:
      sum(active.map((m) => m.xp)) +
      PROJECT_FINISH_BONUS +
      PROJECT_REPOSITORY_BONUS +
      PROJECT_DEPLOY_BONUS,
    earnedXp: state.completedMilestoneXp + projectBonus(state).total,
    repositoryUrl: state.repositoryUrl,
    deployUrl: state.deployUrl,
  }
}

export function listProjects(ctx: AppContext): ProjectSummary[] {
  return loadProjectStates(ctx).map(toSummary)
}

export function findProjectState(ctx: AppContext, slug: string): ProjectState {
  const state = loadProjectStates(ctx).find((p) => p.slug === slug)
  if (!state) throw notFound('Projeto')
  return state
}

export function getProjectDetail(ctx: AppContext, slug: string): ProjectDetail {
  const state = findProjectState(ctx, slug)
  const related = ctx.db
    .select({
      slug: topics.slug,
      title: topics.title,
      status: topicProgress.status,
    })
    .from(projectTopics)
    .innerJoin(topics, eq(topics.id, projectTopics.topicId))
    .leftJoin(topicProgress, eq(topicProgress.topicId, topics.id))
    .where(and(eq(projectTopics.projectId, state.id), isNull(topics.archivedAt)))
    .all()

  return {
    ...toSummary(state),
    milestones: state.milestones
      .filter((m) => !m.archived)
      .map((m) => ({
        key: m.key,
        title: m.title,
        acceptanceCriteria: m.acceptanceCriteria,
        xp: m.xp,
        status: m.status,
        completedAt: m.completedAt,
      })),
    topics: related.map((t) => ({
      slug: t.slug,
      title: t.title,
      status: (t.status ?? 'not_started') as TopicStatus,
    })),
    bonus: projectBonus(state),
  }
}
