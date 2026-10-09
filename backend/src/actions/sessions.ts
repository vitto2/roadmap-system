import { and, eq, isNull } from 'drizzle-orm'
import type { AppContext } from '../context'
import { studySessions, topics } from '../db/schema'
import { notFound, unprocessable } from '../errors'
import { todayLocal } from '../services/settings'

export interface SessionInput {
  studiedOn?: string
  durationMinutes: number
  topicSlug?: string | null
  note?: string
}

function resolveTopicId(ctx: AppContext, slug: string | null | undefined): number | null {
  if (!slug) return null
  const topic = ctx.db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.slug, slug), isNull(topics.archivedAt)))
    .get()
  if (!topic)
    throw unprocessable('Tópico informado não existe.', { topicSlug: ['Tópico inválido.'] })
  return topic.id
}

function assertNotFuture(ctx: AppContext, studiedOn: string): void {
  if (studiedOn > todayLocal(ctx)) {
    throw unprocessable('A data da sessão não pode estar no futuro.', {
      studiedOn: ['Data no futuro.'],
    })
  }
}

export function createSession(ctx: AppContext, input: SessionInput): number {
  const studiedOn = input.studiedOn ?? todayLocal(ctx)
  assertNotFuture(ctx, studiedOn)
  return ctx.db
    .insert(studySessions)
    .values({
      studiedOn,
      durationMinutes: input.durationMinutes,
      topicId: resolveTopicId(ctx, input.topicSlug),
      note: input.note ?? '',
    })
    .returning({ id: studySessions.id })
    .get().id
}

export function updateSession(ctx: AppContext, id: number, input: SessionInput): void {
  const existing = ctx.db.select().from(studySessions).where(eq(studySessions.id, id)).get()
  if (!existing) throw notFound('Sessão')
  const studiedOn = input.studiedOn ?? existing.studiedOn
  assertNotFuture(ctx, studiedOn)
  ctx.db
    .update(studySessions)
    .set({
      studiedOn,
      durationMinutes: input.durationMinutes,
      topicId: resolveTopicId(ctx, input.topicSlug),
      note: input.note ?? '',
    })
    .where(eq(studySessions.id, id))
    .run()
}

export function deleteSession(ctx: AppContext, id: number): void {
  const result = ctx.db.delete(studySessions).where(eq(studySessions.id, id)).run()
  if (result.changes === 0) throw notFound('Sessão')
}
