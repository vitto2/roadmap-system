import { afterEach, describe, expect, it } from 'vitest'
import { createTestEnv, type TestEnv } from '../helpers'

let env: TestEnv
afterEach(async () => env.close())

async function checkAll(slug: string) {
  for (const n of [1, 2, 3])
    await env.call('PUT', `/topics/${slug}/checklist/${slug}-${n}`, { checked: true })
}

describe('trilhas e tópicos', () => {
  it('lista trilhas com progresso', async () => {
    env = createTestEnv()
    const { status, body } = await env.call('GET', '/tracks')
    expect(status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.data[0]).toMatchObject({
      slug: 'core',
      totalTopics: 4,
      completedTopics: 0,
      percent: 0,
      required: true,
    })
  })

  it('filtra tópicos por trilha, nível e status', async () => {
    env = createTestEnv()
    expect((await env.call('GET', '/topics?track=core')).body.data).toHaveLength(4)
    expect((await env.call('GET', '/topics?level=beginner')).body.data).toHaveLength(2)
    expect((await env.call('GET', '/topics?status=completed')).body.data).toHaveLength(0)
    expect((await env.call('GET', '/topics?level=xyz')).status).toBe(422)
  })

  it('mostra pré-requisitos pendentes como "recomendado estudar antes" sem bloquear', async () => {
    env = createTestEnv()
    const { body } = await env.call('GET', '/topics/b')
    expect(body.data.recommendedFirst).toEqual([
      { slug: 'a', title: 'Tópico a', status: 'not_started' },
    ])

    // marcar o tópico b mesmo com a pendente é permitido
    const res = await env.call('PUT', '/topics/b/checklist/b-1', { checked: true })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('studying')
  })

  it('retorna recursos e checklist no detalhe', async () => {
    env = createTestEnv()
    const { body } = await env.call('GET', '/topics/a')
    expect(body.data.checklist).toHaveLength(3)
    expect(body.data.resources[1]).toEqual({ name: 'Livro X', url: null })
    expect(body.data.xp).toBe(10)
  })

  it('atualiza notas e evidência', async () => {
    env = createTestEnv()
    const { status, body } = await env.call('PATCH', '/topics/a/progress', {
      notes: '# Anotações\n\n- ok',
      evidenceUrl: 'https://github.com/vitto2/exemplo',
      status: 'studying',
    })
    expect(status).toBe(200)
    expect(body.data).toMatchObject({
      notes: '# Anotações\n\n- ok',
      evidenceUrl: 'https://github.com/vitto2/exemplo',
      status: 'studying',
    })
    const cleared = await env.call('PATCH', '/topics/a/progress', { evidenceUrl: '' })
    expect(cleared.body.data.evidenceUrl).toBeNull()
  })

  it('valida entradas no servidor (422 padronizado)', async () => {
    env = createTestEnv()
    const bad = await env.call('PATCH', '/topics/a/progress', {
      evidenceUrl: 'javascript:alert(1)',
    })
    expect(bad.status).toBe(422)
    expect(bad.body).toMatchObject({ code: 'validation_failed', message: expect.any(String) })
    expect(Object.keys(bad.body.errors).length).toBeGreaterThan(0)

    const completed = await env.call('PATCH', '/topics/a/progress', { status: 'completed' })
    expect(completed.status).toBe(422)
  })

  it('retorna 404 padronizado', async () => {
    env = createTestEnv()
    const { status, body } = await env.call('GET', '/topics/nao-existe')
    expect(status).toBe(404)
    expect(body).toEqual({ message: 'Tópico não encontrado(a).', code: 'not_found' })
    expect((await env.call('PUT', '/topics/a/checklist/xxx', { checked: true })).status).toBe(404)
  })
})

describe('conclusão e XP', () => {
  it('exige o checklist completo para concluir', async () => {
    env = createTestEnv()
    await env.call('PUT', '/topics/a/checklist/a-1', { checked: true })
    const { status, body } = await env.call('POST', '/topics/a/complete')
    expect(status).toBe(409)
    expect(body.code).toBe('checklist_incomplete')
  })

  it('conclui, concede dificuldade x 10 de XP e agenda 7/30/90 dias', async () => {
    env = createTestEnv()
    await checkAll('b')
    const { status, body } = await env.call('POST', '/topics/b/complete')
    expect(status).toBe(200)
    expect(body.data.status).toBe('completed')
    expect(body.profile.xp.total).toBe(30)
    expect(body.profile.xp.breakdown.topics).toBe(30)
    // 2026-03-10 15:00Z = 12:00 em São Paulo
    expect(
      body.data.reviews.map((r: { intervalDays: number; dueOn: string }) => [
        r.intervalDays,
        r.dueOn,
      ]),
    ).toEqual([
      [7, '2026-03-17'],
      [30, '2026-04-09'],
      [90, '2026-06-08'],
    ])
  })

  it('concluir é idempotente (não duplica XP nem revisões)', async () => {
    env = createTestEnv()
    await checkAll('a')
    await env.call('POST', '/topics/a/complete')
    const second = await env.call('POST', '/topics/a/complete')
    expect(second.body.profile.xp.total).toBe(10)
    expect(second.body.data.reviews).toHaveLength(3)
  })

  it('desmarcar um item de tópico concluído reabre o tópico e desfaz o XP e as revisões', async () => {
    env = createTestEnv()
    await checkAll('a')
    await env.call('POST', '/topics/a/complete')
    const { body } = await env.call('PUT', '/topics/a/checklist/a-2', { checked: false })
    expect(body.data.status).toBe('studying')
    expect(body.data.reviews).toHaveLength(0)
    expect(body.profile.xp.total).toBe(0)
  })

  it('"Já domino" conclui tudo de uma vez e agenda apenas a revisão de 90 dias', async () => {
    env = createTestEnv()
    const { status, body } = await env.call('POST', '/topics/c/master')
    expect(status).toBe(200)
    expect(body.data).toMatchObject({
      status: 'completed',
      masteredDirectly: true,
      checklistChecked: 3,
    })
    expect(body.data.reviews).toHaveLength(1)
    expect(body.data.reviews[0]).toMatchObject({ intervalDays: 90, dueOn: '2026-06-08' })
    expect(body.profile.xp.total).toBe(40)
  })

  it('reabrir desfaz o XP', async () => {
    env = createTestEnv()
    await env.call('POST', '/topics/c/master')
    const { body } = await env.call('POST', '/topics/c/reopen')
    expect(body.data.status).toBe('studying')
    expect(body.profile.xp.total).toBe(0)
    expect(body.data.masteredDirectly).toBe(false)
  })

  it('voltar o status para "estudando" via PATCH também reabre', async () => {
    env = createTestEnv()
    await env.call('POST', '/topics/a/master')
    const { body } = await env.call('PATCH', '/topics/a/progress', { status: 'studying' })
    expect(body.data.status).toBe('studying')
    expect(body.profile.xp.total).toBe(0)
  })

  it('tópico concluído conta no progresso por trilha e geral', async () => {
    env = createTestEnv()
    await env.call('POST', '/topics/a/master')
    const tracks = (await env.call('GET', '/tracks')).body.data
    expect(tracks[0]).toMatchObject({ completedTopics: 1, percent: 25, earnedXp: 10, totalXp: 130 })
    const profile = (await env.call('GET', '/profile')).body.data
    expect(profile.overall).toEqual({ completedTopics: 1, totalTopics: 5, percent: 20 })
  })
})

describe('revisão espaçada', () => {
  it('fila do dia traz revisões vencidas e concluir rende 25% do XP do tópico', async () => {
    env = createTestEnv()
    await checkAll('c') // dificuldade 4 → 40 XP; revisão = 10 XP
    await env.call('POST', '/topics/c/complete')

    expect((await env.call('GET', '/reviews')).body.data).toHaveLength(0)

    env.setNow('2026-03-17T15:00:00Z') // 7 dias depois
    const today = (await env.call('GET', '/reviews')).body.data
    expect(today).toHaveLength(1)
    expect(today[0]).toMatchObject({ intervalDays: 7, xp: 10, overdue: false })

    const done = await env.call('POST', `/reviews/${today[0].id}/complete`)
    expect(done.status).toBe(200)
    expect(done.body.profile.xp.total).toBe(50)
    expect(done.body.profile.xp.breakdown.reviews).toBe(10)
    expect((await env.call('GET', '/reviews')).body.data).toHaveLength(0)

    // idempotente e reversível
    expect((await env.call('POST', `/reviews/${today[0].id}/complete`)).body.profile.xp.total).toBe(
      50,
    )
    expect((await env.call('POST', `/reviews/${today[0].id}/undo`)).body.profile.xp.total).toBe(40)
  })

  it('marca revisões atrasadas', async () => {
    env = createTestEnv()
    await env.call('POST', '/topics/a/master') // 90 dias
    env.setNow('2026-07-01T15:00:00Z')
    const [review] = (await env.call('GET', '/reviews')).body.data
    expect(review.overdue).toBe(true)
  })

  it('lista as próximas revisões', async () => {
    env = createTestEnv()
    await checkAll('a')
    await env.call('POST', '/topics/a/complete')
    expect((await env.call('GET', '/reviews?scope=upcoming')).body.data).toHaveLength(3)
    expect((await env.call('GET', '/reviews/999/complete')).status).toBe(404)
    expect((await env.call('POST', '/reviews/999/complete')).status).toBe(404)
  })
})
