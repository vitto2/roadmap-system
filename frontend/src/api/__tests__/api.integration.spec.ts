// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { setBackend } from '@/lib/backend'
import { createLocalBackend } from '@/lib/backend/local'
import { api } from '..'
import { ApiError } from '../client'

// Roda o front-end contra o SQL REAL (migrations + conteúdo) num Postgres em WebAssembly (PGlite):
// garante que cada função de `api` usa os nomes de função/parâmetros certos e entende o JSON devolvido.

const SLUG = 'fund-logica-de-programacao'
const EMPTY_BACKUP = {
  version: 1,
  exportedAt: '2026-01-01T00:00:00.000Z',
  topics: [],
  projects: [],
  sessions: [],
}

beforeAll(async () => {
  setBackend(await createLocalBackend())
}, 180_000)

afterAll(() => {
  setBackend(undefined)
})

beforeEach(async () => {
  await api.importBackup(EMPTY_BACKUP) // volta ao zero entre os testes
})

async function checkAll(slug: string) {
  const topic = await api.topic(slug)
  for (const item of topic.checklist) await api.setChecklistItem(slug, item.key, true)
  return topic
}

describe('roadmap (conteúdo real)', () => {
  it('lista trilhas, tópicos e filtros', async () => {
    const tracks = await api.tracks()
    expect(tracks).toHaveLength(10)
    expect(tracks.filter((t) => !t.required).map((t) => t.slug)).toEqual(['carreira-soft-skills'])

    const topics = await api.topics()
    expect(topics.length).toBeGreaterThanOrEqual(130)
    expect(
      (await api.topics({ track: 'frontend-vue' })).every((t) => t.trackSlug === 'frontend-vue'),
    ).toBe(true)
    expect((await api.topics({ level: 'senior' })).every((t) => t.careerLevel === 'senior')).toBe(
      true,
    )
    expect(await api.topics({ status: 'completed' })).toEqual([])
  })

  it('o grafo traz pré-requisitos entre trilhas', async () => {
    const graph = await api.graph()
    expect(graph.nodes.length).toBeGreaterThanOrEqual(130)
    expect(graph.edges).toEqual(
      expect.arrayContaining([{ source: 'web-javascript-essencial', target: 'vue-3-e-sfc' }]),
    )
    const vue = graph.nodes.find((n) => n.slug === 'vue-3-e-sfc')!
    expect(vue.unlocked).toBe(false)
    expect(vue.blockedBy).toEqual(expect.arrayContaining(['web-javascript-essencial']))
  })
})

describe('tópicos, XP e revisões', () => {
  it('concluir exige o checklist; "Já domino" e reabrir desfazem o XP', async () => {
    const before = await api.profile()
    expect(before.xp.total).toBe(0)

    await api.setChecklistItem(SLUG, (await api.topic(SLUG)).checklist[0]!.key, true)
    await expect(api.completeTopic(SLUG)).rejects.toMatchObject({
      status: 409,
      code: 'checklist_incomplete',
    })

    const mastered = await api.masterTopic(SLUG)
    expect(mastered.data).toMatchObject({ status: 'completed', masteredDirectly: true })
    expect(mastered.profile.xp.total).toBe(10)
    expect(mastered.data.reviews).toHaveLength(1) // só a revisão de 90 dias

    const reopened = await api.reopenTopic(SLUG)
    expect(reopened.data.status).toBe('studying')
    expect(reopened.profile.xp.total).toBe(0)
  })

  it('conclui pelo checklist completo (3 revisões) e conclui revisões para ganhar XP', async () => {
    await checkAll(SLUG)
    const done = await api.completeTopic(SLUG)
    expect(done.profile.xp.total).toBe(10)
    expect(done.data.reviews.map((r) => r.intervalDays)).toEqual([7, 30, 90])

    const all = await api.reviews('all')
    expect(all).toHaveLength(3)
    expect(await api.reviews('today')).toEqual([])
    expect(await api.reviews('upcoming')).toHaveLength(3)

    // só há revisões futuras; concluir uma adiantada também rende XP (3 = 25% de 10, arredondado)
    const completed = await api.completeReview(all[0]!.id)
    expect(completed.profile.xp.breakdown.reviews).toBe(3)
    expect((await api.undoReview(all[0]!.id)).profile.xp.breakdown.reviews).toBe(0)
  })

  it('salva notas, evidência e status', async () => {
    const { data } = await api.updateTopicProgress(SLUG, {
      notes: '# Notas\n\n- ok',
      evidenceUrl: 'https://github.com/vitto2/roadmap-system',
      status: 'studying',
    })
    expect(data).toMatchObject({ notes: '# Notas\n\n- ok', status: 'studying' })
    const cleared = await api.updateTopicProgress(SLUG, { evidenceUrl: null })
    expect(cleared.data.evidenceUrl).toBeNull()

    const error = await api
      .updateTopicProgress(SLUG, { evidenceUrl: 'javascript:alert(1)' })
      .catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, code: 'validation_failed' })
    expect(error.fieldError('evidenceUrl')).toBeDefined()
  })

  it('traduz erros do banco em ApiError', async () => {
    await expect(api.topic('nao-existe')).rejects.toMatchObject({ status: 404, code: 'not_found' })
    await expect(api.setChecklistItem(SLUG, 'chave-inexistente', true)).rejects.toMatchObject({
      status: 404,
    })
  })
})

describe('projetos', () => {
  it('cumpre as etapas, ganha o bônus de projeto e links', async () => {
    const [first] = await api.projects()
    const slug = first!.slug
    const project = await api.project(slug)
    expect(project.milestones.length).toBeGreaterThanOrEqual(4)

    let last = await api.setMilestoneStatus(slug, project.milestones[0]!.key, 'completed')
    expect(last.profile.xp.breakdown.milestones).toBe(project.milestones[0]!.xp)
    for (const m of project.milestones.slice(1)) {
      last = await api.setMilestoneStatus(slug, m.key, 'completed')
    }
    expect(last.data.status).toBe('finished')
    expect(last.data.bonus.total).toBe(100)

    const withLinks = await api.updateProjectLinks(slug, {
      repositoryUrl: 'https://github.com/vitto2/p',
      deployUrl: 'https://p.example.com',
    })
    expect(withLinks.data.bonus.total).toBe(200)
    expect(withLinks.profile.xp.breakdown.projects).toBe(200)
  })
})

describe('diário, dashboard e configurações', () => {
  it('registra, edita e remove sessões; valida entradas', async () => {
    const created = await api.createSession({
      durationMinutes: 40,
      topicSlug: SLUG,
      note: 'Estudo',
    })
    expect(created.data.topic?.slug).toBe(SLUG)
    expect(created.profile.streak).toMatchObject({
      current: 1,
      studiedToday: true,
      weeklySessions: 1,
    })

    const list = await api.sessions(1, 10)
    expect(list.meta).toEqual({ page: 1, perPage: 10, total: 1 })
    const updated = await api.updateSession(created.data.id, { durationMinutes: 50 })
    expect(updated.data).toMatchObject({ durationMinutes: 50, topic: null })

    const error = await api.createSession({ durationMinutes: 0 }).catch((e) => e)
    expect(error).toMatchObject({ status: 422 })
    expect(error.fieldError('durationMinutes')).toBeDefined()

    const dashboard = await api.dashboard()
    expect(dashboard.weeks).toHaveLength(12)
    expect(dashboard.totals).toEqual({ sessions: 1, minutes: 50 })
    expect(dashboard.radar).toHaveLength(10)

    const removed = await api.deleteSession(created.data.id)
    expect(removed.profile.streak.current).toBe(0)
  })

  it('atualiza e valida configurações', async () => {
    expect(await api.settings()).toEqual({ timezone: 'America/Sao_Paulo', weeklyGoal: 5 })
    expect(await api.updateSettings({ weeklyGoal: 3 })).toEqual({
      timezone: 'America/Sao_Paulo',
      weeklyGoal: 3,
    })
    await expect(api.updateSettings({ timezone: 'Marte/Olympus' })).rejects.toMatchObject({
      status: 422,
    })
    await api.updateSettings({ weeklyGoal: 5 })
  })
})

describe('backup', () => {
  it('exporta o progresso e restaura exatamente o mesmo estado', async () => {
    await checkAll(SLUG)
    await api.completeTopic(SLUG)
    await api.createSession({ durationMinutes: 30 })
    const before = await api.profile()
    const backup = (await api.exportBackup()) as { version: number; topics: unknown[] }
    expect(backup.version).toBe(1)

    await api.importBackup(EMPTY_BACKUP)
    expect((await api.profile()).xp.total).toBe(0)

    const restored = await api.importBackup(backup)
    expect(restored.data.skipped).toEqual([])
    expect(restored.profile.xp.total).toBe(before.xp.total)
    expect((await api.sessions()).meta.total).toBe(1)
  })
})
