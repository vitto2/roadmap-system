import { describe, expect, it } from 'vitest'
import { careerRank } from '../../src/domain/scoring'
import { createDb, runMigrations } from '../../src/db/client'
import {
  allPrerequisites,
  checkSeedIntegrity,
  checkTrackSizes,
  readSeedContent,
} from '../../src/seed/files'
import { seedDatabase } from '../../src/seed/loader'

// Testa o conteúdo REAL do roadmap (backend/database/seed-data).
const content = readSeedContent()
const topics = [...content.topics.values()].flat()

describe('conteúdo do roadmap (seed-data)', () => {
  it('tem as 10 trilhas com 12 a 20 tópicos cada', () => {
    expect(content.tracks).toHaveLength(10)
    expect(checkTrackSizes(content)).toEqual([])
  })

  it('não tem problemas de integridade (slugs, pré-requisitos, ciclos, projetos)', () => {
    expect(checkSeedIntegrity(content)).toEqual([])
  })

  it('só a trilha de carreira é opcional', () => {
    expect(content.tracks.filter((t) => !t.required).map((t) => t.slug)).toEqual([
      'carreira-soft-skills',
    ])
  })

  it('cobre todos os níveis de carreira e dificuldades de 1 a 5', () => {
    expect(new Set(topics.map((t) => t.level))).toEqual(
      new Set(['beginner', 'junior', 'mid', 'senior']),
    )
    expect(new Set(topics.map((t) => t.difficulty))).toEqual(new Set([1, 2, 3, 4, 5]))
  })

  it('pré-requisitos nunca exigem um tópico de nível de carreira maior', () => {
    const bySlug = new Map(topics.map((t) => [t.slug, t]))
    const violations = topics.flatMap((t) =>
      allPrerequisites(content, t)
        .filter((p) => careerRank(bySlug.get(p)!.level) > careerRank(t.level))
        .map((p) => `${t.slug} (${t.level}) <- ${p} (${bySlug.get(p)!.level})`),
    )
    expect(violations).toEqual([])
  })

  it('recursos têm nome e, quando há link, ele é https', () => {
    const bad = topics.flatMap((t) =>
      t.resources
        .filter((r) => r.url !== undefined && !r.url.startsWith('https://'))
        .map((r) => `${t.slug}: ${r.url}`),
    )
    expect(bad).toEqual([])
    expect(topics.every((t) => t.resources.length >= 2)).toBe(true)
  })

  it('checklists têm itens substantivos e sem repetição', () => {
    for (const topic of topics) {
      const texts = topic.checklist.map((c) => c.text)
      expect(new Set(texts).size, topic.slug).toBe(texts.length)
      for (const text of texts) {
        expect(text.length, `${topic.slug}: ${text}`).toBeGreaterThanOrEqual(25)
        expect(text.length, `${topic.slug}: ${text}`).toBeLessThanOrEqual(320)
      }
    }
  })

  it('carrega no banco e o seed é idempotente', () => {
    const { db, close } = createDb(':memory:')
    runMigrations(db)
    const first = seedDatabase(db, content)
    const second = seedDatabase(db, content)
    close()

    expect(first.topics).toBe(topics.length)
    expect(second).toEqual(first)
    expect(second.archived).toEqual({
      tracks: 0,
      topics: 0,
      checklistItems: 0,
      projects: 0,
      milestones: 0,
    })
  })
})

describe('catálogo de projetos', () => {
  it('tem pelo menos 10 projetos do júnior ao sênior', () => {
    expect(content.projects.length).toBeGreaterThanOrEqual(10)
    const levels = new Set(content.projects.map((p) => p.level))
    expect(levels.has('junior')).toBe(true)
    expect(levels.has('senior')).toBe(true)
  })

  it('cada projeto tem de 4 a 6 etapas, com critérios de aceite e XP entre 15 e 60', () => {
    for (const project of content.projects) {
      expect(project.milestones.length, project.slug).toBeGreaterThanOrEqual(4)
      expect(project.milestones.length, project.slug).toBeLessThanOrEqual(6)
      for (const m of project.milestones) {
        expect(m.acceptanceCriteria.length, `${project.slug}/${m.key}`).toBeGreaterThanOrEqual(2)
        expect(m.xp).toBeGreaterThanOrEqual(15)
        expect(m.xp).toBeLessThanOrEqual(60)
      }
    }
  })

  it('relaciona de 3 a 8 tópicos por projeto, incluindo PHP/Laravel e Vue nos projetos da stack', () => {
    for (const project of content.projects) {
      expect(project.topics.length, project.slug).toBeGreaterThanOrEqual(3)
      expect(project.topics.length, project.slug).toBeLessThanOrEqual(8)
    }
    const withPhp = content.projects.filter((p) => p.topics.some((t) => t.startsWith('php-')))
    const withVue = content.projects.filter((p) => p.topics.some((t) => t.startsWith('vue-')))
    expect(withPhp.length).toBeGreaterThanOrEqual(6)
    expect(withVue.length).toBeGreaterThanOrEqual(4)
  })
})
