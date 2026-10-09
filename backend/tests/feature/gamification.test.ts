import { afterEach, describe, expect, it } from 'vitest'
import { createTestEnv, type TestEnv } from '../helpers'

let env: TestEnv
afterEach(async () => env.close())

const complete = (key: string) =>
  env.call('PUT', `/projects/p1/milestones/${key}`, { status: 'completed' })

describe('projetos', () => {
  it('lista o catálogo e o detalhe com critérios de aceite', async () => {
    env = createTestEnv()
    const list = (await env.call('GET', '/projects')).body.data
    expect(list[0]).toMatchObject({
      slug: 'p1',
      status: 'not_started',
      milestonesTotal: 3,
      totalXp: 90 + 200,
    })
    const { body } = await env.call('GET', '/projects/p1')
    expect(body.data.milestones[0]).toMatchObject({
      key: 'm1',
      acceptanceCriteria: ['Critério 1'],
      status: 'pending',
    })
    expect(body.data.topics).toEqual([{ slug: 'b', title: 'Tópico b', status: 'not_started' }])
  })

  it('cada etapa concluída rende o XP definido nela', async () => {
    env = createTestEnv()
    const { body } = await complete('m1')
    expect(body.profile.xp.total).toBe(20)
    expect(body.data).toMatchObject({ status: 'in_progress', milestonesCompleted: 1, earnedXp: 20 })
    expect((await complete('m2')).body.profile.xp.total).toBe(50)
  })

  it('finalizar rende 100 XP; repositório e deploy somam +50 cada', async () => {
    env = createTestEnv()
    await complete('m1')
    await complete('m2')
    const finished = await complete('m3')
    expect(finished.body.data.status).toBe('finished')
    expect(finished.body.profile.xp.total).toBe(90 + 100)

    const withRepo = await env.call('PATCH', '/projects/p1/progress', {
      repositoryUrl: 'https://github.com/vitto2/p1',
    })
    expect(withRepo.body.profile.xp.total).toBe(90 + 150)

    const withDeploy = await env.call('PATCH', '/projects/p1/progress', {
      deployUrl: 'https://p1.example.com',
    })
    expect(withDeploy.body.profile.xp.total).toBe(90 + 200)
    expect(withDeploy.body.data.bonus).toEqual({
      finished: true,
      finishXp: 100,
      repositoryXp: 50,
      deployXp: 50,
      total: 200,
    })
  })

  it('desmarcar uma etapa desfaz o XP da etapa e o bônus do projeto', async () => {
    env = createTestEnv()
    for (const key of ['m1', 'm2', 'm3']) await complete(key)
    const { body } = await env.call('PUT', '/projects/p1/milestones/m3', { status: 'pending' })
    expect(body.profile.xp.total).toBe(50)
    expect(body.data.status).toBe('in_progress')
    expect(body.data.bonus.total).toBe(0)
  })

  it('links sozinhos não geram bônus sem o projeto finalizado', async () => {
    env = createTestEnv()
    const { body } = await env.call('PATCH', '/projects/p1/progress', {
      repositoryUrl: 'https://github.com/vitto2/p1',
    })
    expect(body.profile.xp.total).toBe(0)
    expect(body.data.repositoryUrl).toBe('https://github.com/vitto2/p1')
  })

  it('valida links e etapas inexistentes', async () => {
    env = createTestEnv()
    expect(
      (await env.call('PATCH', '/projects/p1/progress', { deployUrl: 'ftp://x' })).status,
    ).toBe(422)
    expect(
      (await env.call('PUT', '/projects/p1/milestones/zzz', { status: 'completed' })).status,
    ).toBe(404)
    expect((await env.call('PUT', '/projects/p1/milestones/m1', { status: 'done' })).status).toBe(
      422,
    )
  })
})

describe('nível de gamificação e de carreira', () => {
  it('calcula nível a partir do XP derivado', async () => {
    env = createTestEnv()
    await env.call('POST', '/topics/d/master') // 50 XP
    await complete('m1')
    await complete('m2') // + 50 → 100 XP
    const { body } = await env.call('GET', '/profile')
    expect(body.data.xp).toMatchObject({
      total: 100,
      level: 2,
      xpIntoLevel: 0,
      xpForNextLevel: 283,
    })
  })

  it('evolui o nível de carreira nas trilhas obrigatórias (40% / 60% / 80%)', async () => {
    env = createTestEnv()
    expect((await env.call('GET', '/profile')).body.data.career.level).toBe('beginner')

    // tópico "e" é de trilha opcional e não conta
    await env.call('POST', '/topics/e/master')
    expect((await env.call('GET', '/profile')).body.data.career.level).toBe('beginner')

    // a (iniciante) → 1 de 2 tópicos até júnior = 50% ≥ 40%
    await env.call('POST', '/topics/a/master')
    const junior = (await env.call('GET', '/profile')).body.data.career
    expect(junior.level).toBe('junior')
    expect(junior.next).toMatchObject({ level: 'mid', requiredPercent: 60 })

    // a,b,c = 3 de 3 até pleno → pleno; sênior exige 80% de 4 tópicos
    await env.call('POST', '/topics/b/master')
    await env.call('POST', '/topics/c/master')
    expect((await env.call('GET', '/profile')).body.data.career.level).toBe('mid')

    await env.call('POST', '/topics/d/master')
    expect((await env.call('GET', '/profile')).body.data.career.level).toBe('senior')
  })
})

describe('diário, streak e meta semanal', () => {
  it('registra sessões e calcula streak e meta semanal no fuso configurado', async () => {
    env = createTestEnv({ now: '2026-03-11T15:00:00Z' }) // quarta
    for (const studiedOn of ['2026-03-09', '2026-03-10']) {
      const res = await env.call('POST', '/study-sessions', { studiedOn, durationMinutes: 30 })
      expect(res.status).toBe(201)
    }
    const today = await env.call('POST', '/study-sessions', {
      durationMinutes: 45,
      note: 'Vue Router',
    })
    expect(today.body.data).toMatchObject({
      studiedOn: '2026-03-11',
      durationMinutes: 45,
      note: 'Vue Router',
    })
    expect(today.body.profile.streak).toEqual({
      current: 3,
      longest: 3,
      studiedToday: true,
      weeklySessions: 3,
      weeklyGoal: 5,
    })
  })

  it('usa o fuso configurado para definir "hoje"', async () => {
    env = createTestEnv({ now: '2026-03-10T02:30:00Z' }) // 23:30 do dia 9 em São Paulo
    const { body } = await env.call('POST', '/study-sessions', { durationMinutes: 20 })
    expect(body.data.studiedOn).toBe('2026-03-09')

    await env.call('PUT', '/settings', { timezone: 'UTC' })
    const utc = await env.call('POST', '/study-sessions', { durationMinutes: 20 })
    expect(utc.body.data.studiedOn).toBe('2026-03-10')
  })

  it('quebrar o streak não tira XP', async () => {
    env = createTestEnv({ now: '2026-03-10T15:00:00Z' })
    await env.call('POST', '/topics/a/master')
    await env.call('POST', '/study-sessions', { durationMinutes: 30 })
    env.setNow('2026-03-20T15:00:00Z')
    const { body } = await env.call('GET', '/profile')
    expect(body.data.streak.current).toBe(0)
    expect(body.data.xp.total).toBe(10)
  })

  it('lista, edita e remove sessões; valida entradas', async () => {
    env = createTestEnv()
    const created = await env.call('POST', '/study-sessions', {
      durationMinutes: 30,
      topicSlug: 'a',
    })
    const id = created.body.data.id
    expect(created.body.data.topic).toEqual({ slug: 'a', title: 'Tópico a' })

    const updated = await env.call('PUT', `/study-sessions/${id}`, {
      durationMinutes: 50,
      note: 'Revisado',
    })
    expect(updated.body.data).toMatchObject({ durationMinutes: 50, note: 'Revisado', topic: null })

    const list = await env.call('GET', '/study-sessions?perPage=10')
    expect(list.body.meta).toEqual({ page: 1, perPage: 10, total: 1 })

    expect((await env.call('POST', '/study-sessions', { durationMinutes: 0 })).status).toBe(422)
    expect(
      (await env.call('POST', '/study-sessions', { durationMinutes: 10, topicSlug: 'zzz' })).status,
    ).toBe(422)
    expect(
      (await env.call('POST', '/study-sessions', { durationMinutes: 10, studiedOn: '2030-01-01' }))
        .status,
    ).toBe(422)

    expect((await env.call('DELETE', `/study-sessions/${id}`)).status).toBe(200)
    expect((await env.call('DELETE', `/study-sessions/${id}`)).status).toBe(404)
  })

  it('monta o dashboard com radar por trilha e sessões por semana', async () => {
    env = createTestEnv({ now: '2026-03-11T15:00:00Z' })
    await env.call('POST', '/topics/a/master')
    await env.call('POST', '/study-sessions', { durationMinutes: 30 })
    await env.call('POST', '/study-sessions', { durationMinutes: 15, studiedOn: '2026-03-03' })
    const { body } = await env.call('GET', '/dashboard')
    expect(body.data.radar[0]).toEqual({ trackSlug: 'core', title: 'Core', percent: 25 })
    expect(body.data.weeks).toHaveLength(12)
    expect(body.data.weeks.at(-1)).toEqual({ weekStart: '2026-03-09', sessions: 1, minutes: 30 })
    expect(body.data.weeks.at(-2)).toEqual({ weekStart: '2026-03-02', sessions: 1, minutes: 15 })
    expect(body.data.totals).toEqual({ sessions: 2, minutes: 45 })
  })
})

describe('configurações', () => {
  it('atualiza e valida fuso e meta semanal', async () => {
    env = createTestEnv()
    expect((await env.call('GET', '/settings')).body.data).toEqual({
      timezone: 'America/Sao_Paulo',
      weeklyGoal: 5,
    })
    const ok = await env.call('PUT', '/settings', { weeklyGoal: 3 })
    expect(ok.body.data.weeklyGoal).toBe(3)
    expect((await env.call('GET', '/profile')).body.data.streak.weeklyGoal).toBe(3)
    expect((await env.call('PUT', '/settings', { timezone: 'Marte/Olympus' })).status).toBe(422)
    expect((await env.call('PUT', '/settings', { weeklyGoal: 0 })).status).toBe(422)
  })

  it('responde 404 JSON para rotas desconhecidas', async () => {
    env = createTestEnv()
    const res = await env.app.inject({ method: 'GET', url: '/api/v1/nada' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ message: 'Rota não encontrada.', code: 'not_found' })
  })
})
