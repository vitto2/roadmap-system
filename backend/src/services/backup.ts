import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { AppContext } from '../context'
import {
  checklistItems,
  checklistProgress,
  milestoneProgress,
  milestones,
  projectProgress,
  projects,
  reviews,
  studySessions,
  topicProgress,
  topics,
} from '../db/schema'
import { MILESTONE_STATUSES, TOPIC_STATUSES } from '../domain/status'
import { inTransaction } from '../actions/tx'
import { getSettings, updateSettings } from './settings'

const slug = z.string().min(1).max(160)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const instant = z.string().min(1).max(40)

/**
 * Backup do PROGRESSO (não do conteúdo). Usa slugs/keys estáveis em vez de ids, então
 * continua válido depois de rodar o seed de novo ou de restaurar em outro banco.
 */
export const backupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  settings: z
    .object({
      timezone: z.string().optional(),
      weeklyGoal: z.number().int().min(1).max(50).optional(),
    })
    .optional(),
  topics: z.array(
    z.object({
      slug,
      status: z.enum(TOPIC_STATUSES),
      notes: z.string().max(20_000),
      evidenceUrl: z.string().max(500).nullable(),
      startedAt: instant.nullable(),
      completedAt: instant.nullable(),
      masteredDirectly: z.boolean(),
      checked: z.array(z.string().max(160)),
      reviews: z.array(
        z.object({
          intervalDays: z.number().int().min(1).max(3650),
          dueOn: date,
          completedAt: instant.nullable(),
        }),
      ),
    }),
  ),
  projects: z.array(
    z.object({
      slug,
      repositoryUrl: z.string().max(500).nullable(),
      deployUrl: z.string().max(500).nullable(),
      milestones: z.array(
        z.object({
          key: z.string().max(160),
          status: z.enum(MILESTONE_STATUSES),
          completedAt: instant.nullable(),
        }),
      ),
    }),
  ),
  sessions: z.array(
    z.object({
      studiedOn: date,
      durationMinutes: z.number().int().min(1).max(1440),
      topicSlug: slug.nullable(),
      note: z.string().max(500),
    }),
  ),
})

export type Backup = z.infer<typeof backupSchema>

export interface ImportSummary {
  imported: {
    topics: number
    checklistItems: number
    reviews: number
    projects: number
    milestones: number
    sessions: number
  }
  /** Itens do backup que não existem mais no conteúdo atual (ignorados). */
  skipped: string[]
}

export function exportBackup(ctx: AppContext): Backup {
  const { db } = ctx
  const settings = getSettings(ctx)

  const checkedKeys = new Map<number, string[]>()
  for (const row of db
    .select({ topicId: checklistItems.topicId, key: checklistItems.key })
    .from(checklistProgress)
    .innerJoin(checklistItems, eq(checklistItems.id, checklistProgress.checklistItemId))
    .all()) {
    checkedKeys.set(row.topicId, [...(checkedKeys.get(row.topicId) ?? []), row.key])
  }

  const reviewsByTopic = new Map<number, Backup['topics'][number]['reviews']>()
  for (const r of db.select().from(reviews).all()) {
    const list = reviewsByTopic.get(r.topicId) ?? []
    list.push({ intervalDays: r.intervalDays, dueOn: r.dueOn, completedAt: r.completedAt })
    reviewsByTopic.set(r.topicId, list)
  }

  const topicRows = db
    .select({
      topicId: topicProgress.topicId,
      slug: topics.slug,
      status: topicProgress.status,
      notes: topicProgress.notes,
      evidenceUrl: topicProgress.evidenceUrl,
      startedAt: topicProgress.startedAt,
      completedAt: topicProgress.completedAt,
      masteredDirectly: topicProgress.masteredDirectly,
    })
    .from(topicProgress)
    .innerJoin(topics, eq(topics.id, topicProgress.topicId))
    .all()

  const milestoneRows = db
    .select({
      projectId: milestones.projectId,
      key: milestones.key,
      status: milestoneProgress.status,
      completedAt: milestoneProgress.completedAt,
    })
    .from(milestoneProgress)
    .innerJoin(milestones, eq(milestones.id, milestoneProgress.milestoneId))
    .all()

  const projectRows = db
    .select({
      id: projects.id,
      slug: projects.slug,
      repositoryUrl: projectProgress.repositoryUrl,
      deployUrl: projectProgress.deployUrl,
    })
    .from(projects)
    .leftJoin(projectProgress, eq(projectProgress.projectId, projects.id))
    .all()

  const sessionRows = db
    .select({
      studiedOn: studySessions.studiedOn,
      durationMinutes: studySessions.durationMinutes,
      note: studySessions.note,
      topicSlug: topics.slug,
    })
    .from(studySessions)
    .leftJoin(topics, eq(topics.id, studySessions.topicId))
    .all()

  return {
    version: 1,
    exportedAt: ctx.now().toISOString(),
    settings,
    topics: topicRows.map((t) => ({
      slug: t.slug,
      status: t.status as Backup['topics'][number]['status'],
      notes: t.notes,
      evidenceUrl: t.evidenceUrl,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
      masteredDirectly: t.masteredDirectly,
      checked: checkedKeys.get(t.topicId) ?? [],
      reviews: reviewsByTopic.get(t.topicId) ?? [],
    })),
    projects: projectRows
      .map((p) => ({
        slug: p.slug,
        repositoryUrl: p.repositoryUrl ?? null,
        deployUrl: p.deployUrl ?? null,
        milestones: milestoneRows
          .filter((m) => m.projectId === p.id)
          .map((m) => ({
            key: m.key,
            status: m.status as Backup['projects'][number]['milestones'][number]['status'],
            completedAt: m.completedAt,
          })),
      }))
      .filter((p) => p.repositoryUrl || p.deployUrl || p.milestones.length > 0),
    sessions: sessionRows.map((s) => ({
      studiedOn: s.studiedOn,
      durationMinutes: s.durationMinutes,
      topicSlug: s.topicSlug ?? null,
      note: s.note,
    })),
  }
}

/** Restaura o progresso a partir de um backup, SUBSTITUINDO o progresso atual (tudo ou nada). */
export function importBackup(ctx: AppContext, backup: Backup): ImportSummary {
  return inTransaction(ctx, (c) => {
    const { db } = c
    const skipped: string[] = []
    const summary: ImportSummary['imported'] = {
      topics: 0,
      checklistItems: 0,
      reviews: 0,
      projects: 0,
      milestones: 0,
      sessions: 0,
    }

    const topicIds = new Map(
      db
        .select({ id: topics.id, slug: topics.slug })
        .from(topics)
        .all()
        .map((t) => [t.slug, t.id]),
    )
    const itemIds = new Map(
      db
        .select({ id: checklistItems.id, topicId: checklistItems.topicId, key: checklistItems.key })
        .from(checklistItems)
        .all()
        .map((i) => [`${i.topicId}:${i.key}`, i.id]),
    )
    const projectIds = new Map(
      db
        .select({ id: projects.id, slug: projects.slug })
        .from(projects)
        .all()
        .map((p) => [p.slug, p.id]),
    )
    const milestoneIds = new Map(
      db
        .select({ id: milestones.id, projectId: milestones.projectId, key: milestones.key })
        .from(milestones)
        .all()
        .map((m) => [`${m.projectId}:${m.key}`, m.id]),
    )

    // limpa o progresso atual (a ordem respeita as chaves estrangeiras)
    db.delete(reviews).run()
    db.delete(checklistProgress).run()
    db.delete(topicProgress).run()
    db.delete(milestoneProgress).run()
    db.delete(projectProgress).run()
    db.delete(studySessions).run()

    for (const t of backup.topics) {
      const topicId = topicIds.get(t.slug)
      if (topicId === undefined) {
        skipped.push(`tópico "${t.slug}"`)
        continue
      }
      db.insert(topicProgress)
        .values({
          topicId,
          status: t.status,
          notes: t.notes,
          evidenceUrl: t.evidenceUrl,
          startedAt: t.startedAt,
          completedAt: t.completedAt,
          masteredDirectly: t.masteredDirectly,
          updatedAt: c.now().toISOString(),
        })
        .run()
      summary.topics += 1

      for (const key of t.checked) {
        const itemId = itemIds.get(`${topicId}:${key}`)
        if (itemId === undefined) {
          skipped.push(`item "${key}" do tópico "${t.slug}"`)
          continue
        }
        db.insert(checklistProgress)
          .values({
            checklistItemId: itemId,
            checkedAt: t.completedAt ?? t.startedAt ?? backup.exportedAt,
          })
          .run()
        summary.checklistItems += 1
      }

      for (const r of t.reviews) {
        db.insert(reviews)
          .values({
            topicId,
            intervalDays: r.intervalDays,
            dueOn: r.dueOn,
            completedAt: r.completedAt,
          })
          .run()
        summary.reviews += 1
      }
    }

    for (const p of backup.projects) {
      const projectId = projectIds.get(p.slug)
      if (projectId === undefined) {
        skipped.push(`projeto "${p.slug}"`)
        continue
      }
      db.insert(projectProgress)
        .values({
          projectId,
          repositoryUrl: p.repositoryUrl,
          deployUrl: p.deployUrl,
          updatedAt: c.now().toISOString(),
        })
        .run()
      summary.projects += 1

      for (const m of p.milestones) {
        const milestoneId = milestoneIds.get(`${projectId}:${m.key}`)
        if (milestoneId === undefined) {
          skipped.push(`etapa "${m.key}" do projeto "${p.slug}"`)
          continue
        }
        db.insert(milestoneProgress)
          .values({ milestoneId, status: m.status, completedAt: m.completedAt })
          .run()
        summary.milestones += 1
      }
    }

    for (const s of backup.sessions) {
      const topicId = s.topicSlug ? (topicIds.get(s.topicSlug) ?? null) : null
      if (s.topicSlug && topicId === null)
        skipped.push(`tópico "${s.topicSlug}" de uma sessão (mantida sem tópico)`)
      db.insert(studySessions)
        .values({
          studiedOn: s.studiedOn,
          durationMinutes: s.durationMinutes,
          topicId,
          note: s.note,
        })
        .run()
      summary.sessions += 1
    }

    if (backup.settings) updateSettings(c, backup.settings)

    return { imported: summary, skipped }
  })
}
