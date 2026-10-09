import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { checklistItems, topics, tracks } from '../../src/db/schema'
import { seedDatabase } from '../../src/seed/loader'
import { createTestEnv, sampleContent, type TestEnv } from '../helpers'

let env: TestEnv
afterEach(async () => env.close())

describe('seed idempotente', () => {
  it('rodar duas vezes não duplica conteúdo', () => {
    env = createTestEnv()
    const again = seedDatabase(env.ctx.db, sampleContent())
    expect(again).toMatchObject({ tracks: 2, topics: 5, projects: 1, milestones: 3 })
    expect(env.ctx.db.select().from(topics).all()).toHaveLength(5)
    expect(env.ctx.db.select().from(checklistItems).all()).toHaveLength(15)
  })

  it('preserva o progresso ao rodar o seed de novo', async () => {
    env = createTestEnv()
    await env.call('PUT', '/topics/a/checklist/a-1', { checked: true })
    seedDatabase(env.ctx.db, sampleContent())
    const { body } = await env.call('GET', '/topics/a')
    expect(body.data.status).toBe('studying')
    expect(body.data.checklistChecked).toBe(1)
  })

  it('arquiva (sem apagar) o que sumiu do seed e preserva o progresso', async () => {
    env = createTestEnv()
    await env.call('PUT', '/topics/a/checklist/a-1', { checked: true })

    const reduced = sampleContent()
    reduced.topics.set(
      'core',
      reduced.topics
        .get('core')!
        .filter((t) => t.slug !== 'a')
        .map((t) => ({ ...t, prerequisites: [] })),
    )
    const summary = seedDatabase(env.ctx.db, reduced)
    expect(summary.archived.topics).toBe(1)

    // o tópico continua no banco (arquivado) e some da API
    const row = env.ctx.db.select().from(topics).where(eq(topics.slug, 'a')).get()
    expect(row?.archivedAt).not.toBeNull()
    expect((await env.call('GET', '/topics/a')).status).toBe(404)
    const list = (await env.call('GET', '/topics')).body.data as { slug: string }[]
    expect(list.map((t) => t.slug)).not.toContain('a')

    // voltando ao seed, desarquiva e o progresso aparece
    seedDatabase(env.ctx.db, sampleContent())
    const { body } = await env.call('GET', '/topics/a')
    expect(body.data.checklistChecked).toBe(1)
  })

  it('arquiva itens de checklist removidos do seed', async () => {
    env = createTestEnv()
    const changed = sampleContent()
    const a = changed.topics.get('core')![0]!
    a.checklist = a.checklist.slice(0, 2)
    const summary = seedDatabase(env.ctx.db, changed)
    expect(summary.archived.checklistItems).toBe(1)
    expect((await env.call('GET', '/topics/a')).body.data.checklistTotal).toBe(2)
  })

  it('arquiva trilhas removidas', () => {
    env = createTestEnv()
    const changed = sampleContent()
    changed.tracks = changed.tracks.filter((t) => t.slug !== 'extra')
    changed.topics.delete('extra')
    expect(seedDatabase(env.ctx.db, changed).archived.tracks).toBe(1)
    const row = env.ctx.db.select().from(tracks).where(eq(tracks.slug, 'extra')).get()
    expect(row?.archivedAt).not.toBeNull()
  })

  it('rejeita conteúdo com pré-requisito inexistente', () => {
    env = createTestEnv({ seed: false })
    const broken = sampleContent()
    broken.topics.get('core')![1]!.prerequisites = ['nao-existe']
    expect(() => seedDatabase(env.ctx.db, broken)).toThrow(/pré-requisito desconhecido/)
  })
})
