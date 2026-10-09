import { count, desc, eq } from 'drizzle-orm'
import type { AppContext } from '../context'
import { studySessions, topics } from '../db/schema'
import type { StudySessionDto } from '../dto'
import { notFound } from '../errors'

const columns = {
  id: studySessions.id,
  studiedOn: studySessions.studiedOn,
  durationMinutes: studySessions.durationMinutes,
  note: studySessions.note,
  topicSlug: topics.slug,
  topicTitle: topics.title,
}

type Row = {
  id: number
  studiedOn: string
  durationMinutes: number
  note: string
  topicSlug: string | null
  topicTitle: string | null
}

const toDto = (r: Row): StudySessionDto => ({
  id: r.id,
  studiedOn: r.studiedOn,
  durationMinutes: r.durationMinutes,
  note: r.note,
  topic: r.topicSlug && r.topicTitle ? { slug: r.topicSlug, title: r.topicTitle } : null,
})

export function listSessions(
  ctx: AppContext,
  { page, perPage }: { page: number; perPage: number },
): { data: StudySessionDto[]; meta: { page: number; perPage: number; total: number } } {
  const total = ctx.db.select({ value: count() }).from(studySessions).get()?.value ?? 0
  const rows = ctx.db
    .select(columns)
    .from(studySessions)
    .leftJoin(topics, eq(topics.id, studySessions.topicId))
    .orderBy(desc(studySessions.studiedOn), desc(studySessions.id))
    .limit(perPage)
    .offset((page - 1) * perPage)
    .all()
  return { data: rows.map(toDto), meta: { page, perPage, total } }
}

export function getSession(ctx: AppContext, id: number): StudySessionDto {
  const row = ctx.db
    .select(columns)
    .from(studySessions)
    .leftJoin(topics, eq(topics.id, studySessions.topicId))
    .where(eq(studySessions.id, id))
    .get()
  if (!row) throw notFound('Sessão')
  return toDto(row)
}
