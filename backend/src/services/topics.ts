import { and, asc, eq, isNull } from 'drizzle-orm'
import type { AppContext } from '../context'
import {
  checklistItems,
  checklistProgress,
  projects,
  projectTopics,
  reviews,
  topicPrerequisites,
  topicProgress,
  topicResources,
  topics,
  tracks,
} from '../db/schema'
import { reviewXp, topicXp, type CareerLevel } from '../domain/scoring'
import type { TopicStatus } from '../domain/status'
import type {
  ReviewDto,
  TopicDetail,
  TopicRef,
  TopicSummary,
  TrackDetail,
  TrackSummary,
} from '../dto'
import { notFound } from '../errors'
import { isDefined, percentOf, sum } from '../util'
import { todayLocal } from './settings'

export interface TopicRow {
  id: number
  slug: string
  title: string
  description: string
  careerLevel: CareerLevel
  difficulty: number
  trackId: number
  trackSlug: string
  trackTitle: string
  trackRequired: boolean
  status: TopicStatus
  startedAt: string | null
  completedAt: string | null
}

/** Tópicos ativos (de trilhas ativas), na ordem do roadmap, com o status atual. */
export function loadTopicRows(ctx: AppContext): TopicRow[] {
  return ctx.db
    .select({
      id: topics.id,
      slug: topics.slug,
      title: topics.title,
      description: topics.description,
      careerLevel: topics.careerLevel,
      difficulty: topics.difficulty,
      trackId: tracks.id,
      trackSlug: tracks.slug,
      trackTitle: tracks.title,
      trackRequired: tracks.required,
      status: topicProgress.status,
      startedAt: topicProgress.startedAt,
      completedAt: topicProgress.completedAt,
    })
    .from(topics)
    .innerJoin(tracks, eq(tracks.id, topics.trackId))
    .leftJoin(topicProgress, eq(topicProgress.topicId, topics.id))
    .where(and(isNull(topics.archivedAt), isNull(tracks.archivedAt)))
    .orderBy(asc(tracks.position), asc(topics.position))
    .all()
    .map((r) => ({
      ...r,
      careerLevel: r.careerLevel as CareerLevel,
      status: (r.status ?? 'not_started') as TopicStatus,
      startedAt: r.startedAt ?? null,
      completedAt: r.completedAt ?? null,
    }))
}

export function findTopicRow(ctx: AppContext, slug: string): TopicRow {
  const row = loadTopicRows(ctx).find((t) => t.slug === slug)
  if (!row) throw notFound('Tópico')
  return row
}

function checklistCounts(ctx: AppContext): Map<number, { total: number; checked: number }> {
  const rows = ctx.db
    .select({
      topicId: checklistItems.topicId,
      progressId: checklistProgress.id,
    })
    .from(checklistItems)
    .leftJoin(checklistProgress, eq(checklistProgress.checklistItemId, checklistItems.id))
    .where(isNull(checklistItems.archivedAt))
    .all()
  const map = new Map<number, { total: number; checked: number }>()
  for (const r of rows) {
    const entry = map.get(r.topicId) ?? { total: 0, checked: 0 }
    entry.total += 1
    if (r.progressId !== null) entry.checked += 1
    map.set(r.topicId, entry)
  }
  return map
}

function prerequisiteMap(ctx: AppContext): Map<number, number[]> {
  const map = new Map<number, number[]>()
  for (const r of ctx.db.select().from(topicPrerequisites).all()) {
    const list = map.get(r.topicId) ?? []
    list.push(r.prerequisiteId)
    map.set(r.topicId, list)
  }
  return map
}

const toRef = (row: TopicRow): TopicRef => ({
  slug: row.slug,
  title: row.title,
  status: row.status,
})

export function buildTopicSummaries(
  ctx: AppContext,
  rows: TopicRow[] = loadTopicRows(ctx),
): TopicSummary[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const counts = checklistCounts(ctx)
  const prerequisites = prerequisiteMap(ctx)

  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    description: r.description,
    trackSlug: r.trackSlug,
    trackTitle: r.trackTitle,
    careerLevel: r.careerLevel,
    difficulty: r.difficulty,
    xp: topicXp(r.difficulty),
    status: r.status,
    checklistTotal: counts.get(r.id)?.total ?? 0,
    checklistChecked: counts.get(r.id)?.checked ?? 0,
    completedAt: r.completedAt,
    recommendedFirst: (prerequisites.get(r.id) ?? [])
      .map((id) => byId.get(id))
      .filter(isDefined)
      .filter((p) => p.status !== 'completed')
      .map(toRef),
  }))
}

export interface TopicFilters {
  track?: string
  level?: CareerLevel
  status?: TopicStatus
}

export function listTopics(ctx: AppContext, filters: TopicFilters = {}): TopicSummary[] {
  return buildTopicSummaries(ctx).filter(
    (t) =>
      (!filters.track || t.trackSlug === filters.track) &&
      (!filters.level || t.careerLevel === filters.level) &&
      (!filters.status || t.status === filters.status),
  )
}

function summarizeTrack(
  track: { slug: string; title: string; description: string; position: number; required: boolean },
  list: TopicSummary[],
): TrackSummary {
  const completed = list.filter((t) => t.status === 'completed')
  return {
    ...track,
    totalTopics: list.length,
    completedTopics: completed.length,
    studyingTopics: list.filter((t) => t.status === 'studying').length,
    percent: percentOf(completed.length, list.length),
    totalXp: sum(list.map((t) => t.xp)),
    earnedXp: sum(completed.map((t) => t.xp)),
  }
}

function loadTracks(ctx: AppContext) {
  return ctx.db
    .select()
    .from(tracks)
    .where(isNull(tracks.archivedAt))
    .orderBy(asc(tracks.position))
    .all()
}

export function listTracks(ctx: AppContext): TrackSummary[] {
  const summaries = buildTopicSummaries(ctx)
  return loadTracks(ctx).map((t) =>
    summarizeTrack(
      t,
      summaries.filter((s) => s.trackSlug === t.slug),
    ),
  )
}

export function getTrackDetail(ctx: AppContext, slug: string): TrackDetail {
  const track = loadTracks(ctx).find((t) => t.slug === slug)
  if (!track) throw notFound('Trilha')
  const list = buildTopicSummaries(ctx).filter((s) => s.trackSlug === slug)
  return { ...summarizeTrack(track, list), topics: list }
}

export function getTopicDetail(ctx: AppContext, slug: string): TopicDetail {
  const row = findTopicRow(ctx, slug)
  const summary = buildTopicSummaries(ctx).find((s) => s.slug === slug)!
  const rows = loadTopicRows(ctx)
  const byId = new Map(rows.map((r) => [r.id, r]))

  const checklist = ctx.db
    .select({
      key: checklistItems.key,
      text: checklistItems.text,
      progressId: checklistProgress.id,
    })
    .from(checklistItems)
    .leftJoin(checklistProgress, eq(checklistProgress.checklistItemId, checklistItems.id))
    .where(and(eq(checklistItems.topicId, row.id), isNull(checklistItems.archivedAt)))
    .orderBy(asc(checklistItems.position))
    .all()
    .map((i) => ({ key: i.key, text: i.text, checked: i.progressId !== null }))

  const resources = ctx.db
    .select({ name: topicResources.name, url: topicResources.url })
    .from(topicResources)
    .where(eq(topicResources.topicId, row.id))
    .orderBy(asc(topicResources.position))
    .all()

  const prerequisites = ctx.db
    .select({ prerequisiteId: topicPrerequisites.prerequisiteId })
    .from(topicPrerequisites)
    .where(eq(topicPrerequisites.topicId, row.id))
    .all()
    .map((p) => byId.get(p.prerequisiteId))
    .filter(isDefined)
    .map(toRef)

  const progress = ctx.db
    .select()
    .from(topicProgress)
    .where(eq(topicProgress.topicId, row.id))
    .get()

  const topicReviews = ctx.db
    .select({
      id: reviews.id,
      intervalDays: reviews.intervalDays,
      dueOn: reviews.dueOn,
      completedAt: reviews.completedAt,
    })
    .from(reviews)
    .where(eq(reviews.topicId, row.id))
    .orderBy(asc(reviews.intervalDays))
    .all()

  const relatedProjects = ctx.db
    .select({ slug: projects.slug, title: projects.title })
    .from(projectTopics)
    .innerJoin(projects, eq(projects.id, projectTopics.projectId))
    .where(and(eq(projectTopics.topicId, row.id), isNull(projects.archivedAt)))
    .orderBy(asc(projects.position))
    .all()

  return {
    ...summary,
    checklist,
    resources,
    prerequisites,
    notes: progress?.notes ?? '',
    evidenceUrl: progress?.evidenceUrl ?? null,
    startedAt: progress?.startedAt ?? null,
    masteredDirectly: progress?.masteredDirectly ?? false,
    reviews: topicReviews,
    projects: relatedProjects,
  }
}

export type ReviewScope = 'today' | 'upcoming' | 'pending' | 'completed' | 'all'

/** Fila de revisões. `today` inclui as atrasadas (due_on <= hoje) ainda não concluídas. */
export function listReviews(ctx: AppContext, scope: ReviewScope = 'today'): ReviewDto[] {
  const today = todayLocal(ctx)
  const rows = ctx.db
    .select({
      id: reviews.id,
      intervalDays: reviews.intervalDays,
      dueOn: reviews.dueOn,
      completedAt: reviews.completedAt,
      topicSlug: topics.slug,
      topicTitle: topics.title,
      difficulty: topics.difficulty,
    })
    .from(reviews)
    .innerJoin(topics, eq(topics.id, reviews.topicId))
    .orderBy(asc(reviews.dueOn), asc(reviews.id))
    .all()

  return rows
    .filter((r) => {
      const open = r.completedAt === null
      switch (scope) {
        case 'today':
          return open && r.dueOn <= today
        case 'upcoming':
          return open && r.dueOn > today
        case 'pending':
          return open
        case 'completed':
          return !open
        default:
          return true
      }
    })
    .map((r) => ({
      id: r.id,
      topic: { slug: r.topicSlug, title: r.topicTitle },
      intervalDays: r.intervalDays,
      dueOn: r.dueOn,
      completedAt: r.completedAt,
      xp: reviewXp(r.difficulty),
      overdue: r.completedAt === null && r.dueOn < today,
    }))
}
