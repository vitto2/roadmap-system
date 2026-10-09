import { and, eq, isNull } from 'drizzle-orm'
import type { AppContext } from '../context'
import { checklistItems, checklistProgress, reviews, topicProgress, topics } from '../db/schema'
import { scheduleReviews, type ScheduledReview } from '../domain/scoring'
import type { TopicStatus } from '../domain/status'
import { conflict, notFound } from '../errors'
import { todayLocal } from '../services/settings'
import { inTransaction } from './tx'

interface TopicRef {
  id: number
  slug: string
}

function findTopic(ctx: AppContext, slug: string): TopicRef {
  const topic = ctx.db
    .select({ id: topics.id, slug: topics.slug })
    .from(topics)
    .where(and(eq(topics.slug, slug), isNull(topics.archivedAt)))
    .get()
  if (!topic) throw notFound('Tópico')
  return topic
}

function ensureProgress(ctx: AppContext, topicId: number) {
  ctx.db.insert(topicProgress).values({ topicId }).onConflictDoNothing().run()
  return ctx.db.select().from(topicProgress).where(eq(topicProgress.topicId, topicId)).get()!
}

function activeChecklist(ctx: AppContext, topicId: number) {
  return ctx.db
    .select({ id: checklistItems.id, checkedId: checklistProgress.id })
    .from(checklistItems)
    .leftJoin(checklistProgress, eq(checklistProgress.checklistItemId, checklistItems.id))
    .where(and(eq(checklistItems.topicId, topicId), isNull(checklistItems.archivedAt)))
    .all()
}

function replaceReviews(ctx: AppContext, topicId: number, schedule: ScheduledReview[]): void {
  ctx.db.delete(reviews).where(eq(reviews.topicId, topicId)).run()
  if (schedule.length > 0) {
    ctx.db
      .insert(reviews)
      .values(schedule.map((s) => ({ topicId, intervalDays: s.intervalDays, dueOn: s.dueOn })))
      .run()
  }
}

/** Desfaz a conclusão: o XP do tópico e das revisões deixa de contar (é derivado). */
function reopen(ctx: AppContext, topicId: number): void {
  const now = ctx.now().toISOString()
  ctx.db
    .update(topicProgress)
    .set({ status: 'studying', completedAt: null, masteredDirectly: false, updatedAt: now })
    .where(eq(topicProgress.topicId, topicId))
    .run()
  ctx.db.delete(reviews).where(eq(reviews.topicId, topicId)).run()
}

export function setChecklistItem(
  ctx: AppContext,
  topicSlug: string,
  key: string,
  checked: boolean,
): void {
  inTransaction(ctx, (c) => {
    const topic = findTopic(c, topicSlug)
    const item = c.db
      .select({ id: checklistItems.id })
      .from(checklistItems)
      .where(
        and(
          eq(checklistItems.topicId, topic.id),
          eq(checklistItems.key, key),
          isNull(checklistItems.archivedAt),
        ),
      )
      .get()
    if (!item) throw notFound('Item do checklist')

    const progress = ensureProgress(c, topic.id)
    const now = c.now().toISOString()

    if (checked) {
      c.db
        .insert(checklistProgress)
        .values({ checklistItemId: item.id, checkedAt: now })
        .onConflictDoNothing()
        .run()
      if (progress.status === 'not_started') {
        c.db
          .update(topicProgress)
          .set({ status: 'studying', startedAt: progress.startedAt ?? now, updatedAt: now })
          .where(eq(topicProgress.topicId, topic.id))
          .run()
      }
    } else {
      c.db.delete(checklistProgress).where(eq(checklistProgress.checklistItemId, item.id)).run()
      if (progress.status === 'completed') reopen(c, topic.id)
    }
  })
}

export function completeTopic(ctx: AppContext, topicSlug: string): void {
  inTransaction(ctx, (c) => {
    const topic = findTopic(c, topicSlug)
    const progress = ensureProgress(c, topic.id)
    if (progress.status === 'completed') return

    if (activeChecklist(c, topic.id).some((i) => i.checkedId === null)) {
      throw conflict(
        'checklist_incomplete',
        'Marque todos os itens do checklist antes de concluir o tópico.',
      )
    }
    finish(c, topic.id, progress.startedAt, false)
  })
}

/** "Já domino": marca o checklist inteiro e conclui o tópico; agenda só a revisão de 90 dias. */
export function masterTopic(ctx: AppContext, topicSlug: string): void {
  inTransaction(ctx, (c) => {
    const topic = findTopic(c, topicSlug)
    const progress = ensureProgress(c, topic.id)
    if (progress.status === 'completed') return

    const now = c.now().toISOString()
    for (const item of activeChecklist(c, topic.id)) {
      if (item.checkedId === null) {
        c.db
          .insert(checklistProgress)
          .values({ checklistItemId: item.id, checkedAt: now })
          .onConflictDoNothing()
          .run()
      }
    }
    finish(c, topic.id, progress.startedAt, true)
  })
}

function finish(
  ctx: AppContext,
  topicId: number,
  startedAt: string | null,
  mastered: boolean,
): void {
  const now = ctx.now().toISOString()
  ctx.db
    .update(topicProgress)
    .set({
      status: 'completed',
      completedAt: now,
      startedAt: startedAt ?? now,
      masteredDirectly: mastered,
      updatedAt: now,
    })
    .where(eq(topicProgress.topicId, topicId))
    .run()
  replaceReviews(ctx, topicId, scheduleReviews(todayLocal(ctx), mastered))
}

export function reopenTopic(ctx: AppContext, topicSlug: string): void {
  inTransaction(ctx, (c) => {
    const topic = findTopic(c, topicSlug)
    const progress = ensureProgress(c, topic.id)
    if (progress.status === 'completed') reopen(c, topic.id)
  })
}

export interface TopicProgressPatch {
  status?: Exclude<TopicStatus, 'completed'>
  notes?: string
  evidenceUrl?: string | null
}

export function updateTopicProgress(
  ctx: AppContext,
  topicSlug: string,
  patch: TopicProgressPatch,
): void {
  inTransaction(ctx, (c) => {
    const topic = findTopic(c, topicSlug)
    const progress = ensureProgress(c, topic.id)
    const now = c.now().toISOString()

    const set: Partial<typeof topicProgress.$inferInsert> = { updatedAt: now }
    if (patch.notes !== undefined) set.notes = patch.notes
    if (patch.evidenceUrl !== undefined) set.evidenceUrl = patch.evidenceUrl

    if (patch.status !== undefined) {
      if (progress.status === 'completed') reopen(c, topic.id)
      set.status = patch.status
      if (patch.status === 'studying') set.startedAt = progress.startedAt ?? now
      if (patch.status === 'not_started') set.startedAt = null
    }

    c.db.update(topicProgress).set(set).where(eq(topicProgress.topicId, topic.id)).run()
  })
}
