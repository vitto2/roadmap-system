import { readFileSync } from 'node:fs'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildPayload } from '../../src/content/payload'
import { readSeedContent } from '../../src/content/files'
import { SEED_FILE } from '../../src/paths'
import { createHarness, type Harness, type Json } from '../support/harness'
import { sampleContent } from '../support/sample'

let h: Harness
beforeAll(async () => {
  h = await createHarness()
})
beforeEach(async () => {
  await h.begin()
  await h.setNow('2026-03-10T15:00:00Z')
})
afterEach(async () => {
  await h.rollback()
})
afterAll(async () => {
  await h.db.close()
})

const sync = async (payload: unknown) =>
  (
    await h.admin.query<Json>('select app.sync_content($1::jsonb) as summary', [
      JSON.stringify(payload),
    ])
  )[0].summary
const count = async (table: string, where = 'true') =>
  Number(
    (await h.admin.query<Json>(`select count(*)::int as n from app.${table} where ${where}`))[0].n,
  )

describe('app.sync_content (carga idempotente do conteúdo)', () => {
  it('rodar de novo não duplica nada e devolve o mesmo resumo', async () => {
    const first = await sync(sampleContent())
    const second = await sync(sampleContent())
    expect(second).toEqual(first)
    expect(second).toMatchObject({
      tracks: 2,
      topics: 5,
      checklistItems: 15,
      projects: 1,
      milestones: 3,
    })
    expect(second.archived).toEqual({
      tracks: 0,
      topics: 0,
      checklistItems: 0,
      projects: 0,
      milestones: 0,
    })
    expect(await count('topics')).toBe(5)
    expect(await count('checklist_items')).toBe(15)
    expect(await count('topic_prerequisites')).toBe(2)
    expect(await count('topic_resources')).toBe(10)
  })

  it('atualiza título, descrição, dificuldade e posição (upsert pelo slug)', async () => {
    const payload = sampleContent()
    payload.topics[0]!.title = 'Novo título'
    payload.topics[0]!.difficulty = 2
    await sync(payload)
    const topic = await h.alice.rpc<Json>('get_topic', { p_slug: 'a' })
    expect(topic).toMatchObject({ title: 'Novo título', difficulty: 2, xp: 20 })
  })

  it('preserva o progresso ao rodar o seed de novo', async () => {
    await h.alice.rpc('set_checklist_item', { p_slug: 'a', p_key: 'a-1', p_checked: true })
    await sync(sampleContent())
    const topic = await h.alice.rpc<Json>('get_topic', { p_slug: 'a' })
    expect(topic.status).toBe('studying')
    expect(topic.checklistChecked).toBe(1)
  })

  it('arquiva (sem apagar) o que sumiu do conteúdo e preserva o progresso; ao voltar, desarquiva', async () => {
    await h.alice.rpc('set_checklist_item', { p_slug: 'a', p_key: 'a-1', p_checked: true })

    const reduced = sampleContent()
    reduced.topics = reduced.topics
      .filter((t) => t.slug !== 'a')
      .map((t) => ({ ...t, prerequisites: [] }))
    const summary = await sync(reduced)
    expect(summary.archived.topics).toBe(1)

    // continua no banco (arquivado) e some da API
    expect(await count('topics', `slug = 'a' and archived_at is not null`)).toBe(1)
    expect(await count('topic_progress')).toBe(1)
    await expect(h.alice.rpc('get_topic', { p_slug: 'a' })).rejects.toMatchObject({ code: 'PT404' })
    const list = await h.alice.rpc<Json[]>('list_topics')
    expect(list.map((t) => t.slug)).not.toContain('a')

    // voltando ao conteúdo, desarquiva e o progresso reaparece
    await sync(sampleContent())
    expect((await h.alice.rpc<Json>('get_topic', { p_slug: 'a' })).checklistChecked).toBe(1)
  })

  it('o XP de tópicos arquivados continua contando (nada some silenciosamente)', async () => {
    await h.alice.rpc('master_topic', { p_slug: 'd' })
    const reduced = sampleContent()
    reduced.topics = reduced.topics.filter((t) => t.slug !== 'd')
    await sync(reduced)
    const profile = await h.alice.rpc<Json>('get_profile')
    expect(profile.xp.total).toBe(50)
    expect(profile.overall.totalTopics).toBe(4) // mas não entra nos percentuais
  })

  it('arquiva itens de checklist removidos', async () => {
    const changed = sampleContent()
    changed.topics[0]!.checklist = changed.topics[0]!.checklist.slice(0, 2)
    const summary = await sync(changed)
    expect(summary.archived.checklistItems).toBe(1)
    expect((await h.alice.rpc<Json>('get_topic', { p_slug: 'a' })).checklistTotal).toBe(2)
  })

  it('arquiva trilhas removidas', async () => {
    const changed = sampleContent()
    changed.tracks = changed.tracks.filter((t) => t.slug !== 'extra')
    changed.topics = changed.topics.filter((t) => t.track !== 'extra')
    expect((await sync(changed)).archived.tracks).toBe(1)
    expect((await h.alice.rpc<Json[]>('list_tracks')).map((t) => t.slug)).toEqual(['core'])
  })

  it('arquiva etapas removidas; o XP das já concluídas continua contando', async () => {
    for (const key of ['m1', 'm2', 'm3']) {
      await h.alice.rpc('set_milestone_status', { p_slug: 'p1', p_key: key, p_status: 'completed' })
    }
    const changed = sampleContent()
    changed.projects[0]!.milestones = changed.projects[0]!.milestones.slice(0, 2)
    expect((await sync(changed)).archived.milestones).toBe(1)

    const project = await h.alice.rpc<Json>('get_project', { p_slug: 'p1' })
    expect(project.milestonesTotal).toBe(2)
    expect(project.status).toBe('finished') // todas as etapas ativas concluídas
    expect((await h.alice.rpc<Json>('get_profile')).xp.total).toBe(20 + 30 + 40 + 100)
  })

  it('rejeita conteúdo com pré-requisito, trilha ou tópico inexistente', async () => {
    const badPrereq = sampleContent()
    badPrereq.topics[1]!.prerequisites = ['nao-existe']
    await expect(sync(badPrereq)).rejects.toThrow(/Pré-requisitos inexistentes/)

    const badTrack = sampleContent()
    badTrack.topics[0]!.track = 'fantasma'
    await expect(sync(badTrack)).rejects.toThrow(/trilha inexistente/)

    const badProject = sampleContent()
    badProject.projects[0]!.topics = ['fantasma']
    await expect(sync(badProject)).rejects.toThrow(/tópicos inexistentes/)
  })
})

describe('seed.sql (conteúdo real)', () => {
  it('carrega o roadmap completo, é idempotente e o app enxerga tudo', async () => {
    const sql = readFileSync(SEED_FILE, 'utf8')
    const expected = buildPayload(readSeedContent())
    const fresh = await createHarness({ content: false }) // banco só com as migrations (sem o conteúdo de exemplo)
    try {
      await fresh.db.exec(sql)
      await fresh.db.exec(sql) // segunda carga: nada muda
      const n = async (table: string, where = 'true') =>
        Number(
          (
            await fresh.admin.query<Json>(
              `select count(*)::int as n from app.${table} where ${where}`,
            )
          )[0].n,
        )

      expect(await n('tracks')).toBe(expected.tracks.length)
      expect(await n('topics')).toBe(expected.topics.length)
      expect(await n('projects')).toBe(expected.projects.length)
      expect(await n('checklist_items')).toBe(
        expected.topics.reduce((sum, t) => sum + t.checklist.length, 0),
      )
      expect(await n('milestones')).toBe(
        expected.projects.reduce((sum, p) => sum + p.milestones.length, 0),
      )
      expect(await n('topics', 'archived_at is not null')).toBe(0)

      await fresh.begin()
      const tracks = await fresh.alice.rpc<Json[]>('list_tracks')
      expect(tracks).toHaveLength(10)
      const graph = await fresh.alice.rpc<Json>('get_graph')
      expect(graph.edges).toEqual(
        expect.arrayContaining([{ source: 'web-javascript-essencial', target: 'vue-3-e-sfc' }]),
      )
      expect((await fresh.alice.rpc<Json[]>('list_projects')).length).toBeGreaterThanOrEqual(10)
      await fresh.rollback()
    } finally {
      await fresh.db.close()
    }
  })
})
