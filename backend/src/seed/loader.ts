import { and, eq, isNull, notInArray } from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { Db } from '../db/client'
import {
  checklistItems,
  milestones,
  projects,
  projectTopics,
  topicPrerequisites,
  topicResources,
  topics,
  tracks,
} from '../db/schema'
import { allPrerequisites, checkSeedIntegrity, type SeedContent } from './files'

export interface SeedSummary {
  tracks: number
  topics: number
  checklistItems: number
  projects: number
  milestones: number
  archived: {
    tracks: number
    topics: number
    checklistItems: number
    projects: number
    milestones: number
  }
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * Carrega o conteúdo de forma idempotente (upsert pelo slug estável).
 * Itens que sumiram do seed NÃO são apagados: recebem archived_at, preservando o progresso.
 * Itens que voltam ao seed são desarquivados.
 */
export function seedDatabase(db: Db, content: SeedContent, now: Date = new Date()): SeedSummary {
  const problems = checkSeedIntegrity(content)
  if (problems.length > 0) {
    throw new Error(`Seed com problemas de integridade:\n - ${problems.join('\n - ')}`)
  }
  const stamp = now.toISOString()

  return db.transaction((tx) => {
    const summary: SeedSummary = {
      tracks: 0,
      topics: 0,
      checklistItems: 0,
      projects: 0,
      milestones: 0,
      archived: { tracks: 0, topics: 0, checklistItems: 0, projects: 0, milestones: 0 },
    }

    // ── Trilhas ──
    const trackIds = new Map<string, number>()
    content.tracks.forEach((track, position) => {
      const row = tx
        .insert(tracks)
        .values({ ...track, position })
        .onConflictDoUpdate({
          target: tracks.slug,
          set: {
            title: track.title,
            description: track.description,
            required: track.required,
            position,
            archivedAt: null,
          },
        })
        .returning({ id: tracks.id })
        .get()
      trackIds.set(track.slug, row.id)
      summary.tracks += 1
    })
    summary.archived.tracks = archiveMissing(
      tx,
      tracks,
      tracks.slug,
      tracks.archivedAt,
      content.tracks.map((t) => t.slug),
      stamp,
    )

    // ── Tópicos ──
    const topicIds = new Map<string, number>()
    const seededTopics = [...content.topics.entries()].flatMap(([trackSlug, list]) =>
      list.map((topic, position) => ({ trackSlug, topic, position })),
    )
    for (const { trackSlug, topic, position } of seededTopics) {
      const trackId = trackIds.get(trackSlug)!
      const row = tx
        .insert(topics)
        .values({
          trackId,
          slug: topic.slug,
          title: topic.title,
          description: topic.description,
          careerLevel: topic.level,
          difficulty: topic.difficulty,
          position,
        })
        .onConflictDoUpdate({
          target: topics.slug,
          set: {
            trackId,
            title: topic.title,
            description: topic.description,
            careerLevel: topic.level,
            difficulty: topic.difficulty,
            position,
            archivedAt: null,
          },
        })
        .returning({ id: topics.id })
        .get()
      topicIds.set(topic.slug, row.id)
      summary.topics += 1
    }
    summary.archived.topics = archiveMissing(
      tx,
      topics,
      topics.slug,
      topics.archivedAt,
      seededTopics.map((t) => t.topic.slug),
      stamp,
    )

    // ── Relações de conteúdo (pré-requisitos, recursos) e checklist ──
    for (const { topic } of seededTopics) {
      const topicId = topicIds.get(topic.slug)!

      tx.delete(topicPrerequisites).where(eq(topicPrerequisites.topicId, topicId)).run()
      const prerequisites = allPrerequisites(content, topic)
      if (prerequisites.length > 0) {
        tx.insert(topicPrerequisites)
          .values(prerequisites.map((p) => ({ topicId, prerequisiteId: topicIds.get(p)! })))
          .run()
      }

      tx.delete(topicResources).where(eq(topicResources.topicId, topicId)).run()
      if (topic.resources.length > 0) {
        tx.insert(topicResources)
          .values(
            topic.resources.map((r, position) => ({
              topicId,
              name: r.name,
              url: r.url ?? null,
              position,
            })),
          )
          .run()
      }

      topic.checklist.forEach((item, position) => {
        tx.insert(checklistItems)
          .values({ topicId, key: item.key, text: item.text, position })
          .onConflictDoUpdate({
            target: [checklistItems.topicId, checklistItems.key],
            set: { text: item.text, position, archivedAt: null },
          })
          .run()
        summary.checklistItems += 1
      })
      const keys = topic.checklist.map((c) => c.key)
      const result = tx
        .update(checklistItems)
        .set({ archivedAt: stamp })
        .where(
          and(
            eq(checklistItems.topicId, topicId),
            isNull(checklistItems.archivedAt),
            notInArray(checklistItems.key, keys),
          ),
        )
        .run()
      summary.archived.checklistItems += result.changes
    }

    // ── Projetos e etapas ──
    const projectIds = new Map<string, number>()
    content.projects.forEach((project, position) => {
      const row = tx
        .insert(projects)
        .values({
          slug: project.slug,
          title: project.title,
          description: project.description,
          careerLevel: project.level,
          difficulty: project.difficulty,
          position,
        })
        .onConflictDoUpdate({
          target: projects.slug,
          set: {
            title: project.title,
            description: project.description,
            careerLevel: project.level,
            difficulty: project.difficulty,
            position,
            archivedAt: null,
          },
        })
        .returning({ id: projects.id })
        .get()
      const projectId = row.id
      projectIds.set(project.slug, projectId)
      summary.projects += 1

      tx.delete(projectTopics).where(eq(projectTopics.projectId, projectId)).run()
      if (project.topics.length > 0) {
        tx.insert(projectTopics)
          .values(project.topics.map((slug) => ({ projectId, topicId: topicIds.get(slug)! })))
          .run()
      }

      project.milestones.forEach((m, mPosition) => {
        tx.insert(milestones)
          .values({
            projectId,
            key: m.key,
            title: m.title,
            acceptanceCriteria: JSON.stringify(m.acceptanceCriteria),
            xp: m.xp,
            position: mPosition,
          })
          .onConflictDoUpdate({
            target: [milestones.projectId, milestones.key],
            set: {
              title: m.title,
              acceptanceCriteria: JSON.stringify(m.acceptanceCriteria),
              xp: m.xp,
              position: mPosition,
              archivedAt: null,
            },
          })
          .run()
        summary.milestones += 1
      })
      const result = tx
        .update(milestones)
        .set({ archivedAt: stamp })
        .where(
          and(
            eq(milestones.projectId, projectId),
            isNull(milestones.archivedAt),
            notInArray(
              milestones.key,
              project.milestones.map((m) => m.key),
            ),
          ),
        )
        .run()
      summary.archived.milestones += result.changes
    })
    summary.archived.projects = archiveMissing(
      tx,
      projects,
      projects.slug,
      projects.archivedAt,
      content.projects.map((p) => p.slug),
      stamp,
    )

    return summary
  })
}

/** Arquiva (archived_at) os registros ativos cujo slug não está mais no seed. */
function archiveMissing(
  tx: Tx,
  table: typeof tracks | typeof topics | typeof projects,
  slugColumn: SQLiteColumn,
  archivedColumn: SQLiteColumn,
  seededSlugs: string[],
  stamp: string,
): number {
  const where =
    seededSlugs.length === 0
      ? isNull(archivedColumn)
      : and(isNull(archivedColumn), notInArray(slugColumn, seededSlugs))
  return tx.update(table).set({ archivedAt: stamp }).where(where).run().changes
}
