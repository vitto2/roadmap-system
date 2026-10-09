import { and, eq, isNull } from 'drizzle-orm'
import type { AppContext } from '../context'
import { milestoneProgress, milestones, projectProgress, projects } from '../db/schema'
import type { MilestoneStatus } from '../domain/status'
import { notFound } from '../errors'
import { inTransaction } from './tx'

function findProjectId(ctx: AppContext, slug: string): number {
  const project = ctx.db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.slug, slug), isNull(projects.archivedAt)))
    .get()
  if (!project) throw notFound('Projeto')
  return project.id
}

/** Define o status de uma etapa. O XP da etapa e o bônus do projeto são derivados disso. */
export function setMilestoneStatus(
  ctx: AppContext,
  projectSlug: string,
  key: string,
  status: MilestoneStatus,
): void {
  inTransaction(ctx, (c) => {
    const projectId = findProjectId(c, projectSlug)
    const milestone = c.db
      .select({ id: milestones.id })
      .from(milestones)
      .where(
        and(
          eq(milestones.projectId, projectId),
          eq(milestones.key, key),
          isNull(milestones.archivedAt),
        ),
      )
      .get()
    if (!milestone) throw notFound('Etapa')

    const completedAt = status === 'completed' ? c.now().toISOString() : null
    c.db
      .insert(milestoneProgress)
      .values({ milestoneId: milestone.id, status, completedAt })
      .onConflictDoUpdate({
        target: milestoneProgress.milestoneId,
        set: { status, completedAt },
      })
      .run()
  })
}

export interface ProjectLinksPatch {
  repositoryUrl?: string | null
  deployUrl?: string | null
}

export function updateProjectLinks(
  ctx: AppContext,
  projectSlug: string,
  patch: ProjectLinksPatch,
): void {
  inTransaction(ctx, (c) => {
    const projectId = findProjectId(c, projectSlug)
    const now = c.now().toISOString()
    c.db.insert(projectProgress).values({ projectId }).onConflictDoNothing().run()
    const set: Partial<typeof projectProgress.$inferInsert> = { updatedAt: now }
    if (patch.repositoryUrl !== undefined) set.repositoryUrl = patch.repositoryUrl
    if (patch.deployUrl !== undefined) set.deployUrl = patch.deployUrl
    c.db.update(projectProgress).set(set).where(eq(projectProgress.projectId, projectId)).run()
  })
}
