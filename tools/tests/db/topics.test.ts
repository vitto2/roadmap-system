import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { checkAll, createHarness, type Harness, type Json } from '../support/harness'

let h: Harness
beforeAll(async () => {
  h = await createHarness()
})
beforeEach(async () => {
  await h.begin()
  await h.setNow('2026-03-10T15:00:00Z') // 12:00 em São Paulo
})
afterEach(async () => {
  await h.rollback()
})

const reviewsOf = (detail: Json) =>
  detail.reviews.map((r: { intervalDays: number; dueOn: string }) => [r.intervalDays, r.dueOn])

describe('trilhas e tópicos', () => {
  it('lista trilhas com progresso', async () => {
    const tracks = await h.alice.rpc<Json[]>('list_tracks')
    expect(tracks).toHaveLength(2)
    expect(tracks[0]).toMatchObject({
      slug: 'core',
      totalTopics: 4,
      completedTopics: 0,
      percent: 0,
      required: true,
    })
  })

  it('filtra tópicos por trilha, nível e status', async () => {
    expect(await h.alice.rpc<Json[]>('list_topics', { p_track: 'core' })).toHaveLength(4)
    expect(await h.alice.rpc<Json[]>('list_topics', { p_level: 'beginner' })).toHaveLength(2)
    expect(await h.alice.rpc<Json[]>('list_topics', { p_status: 'completed' })).toHaveLength(0)
    await expect(h.alice.rpc('list_topics', { p_level: 'xyz' })).rejects.toMatchObject({
      code: 'PT422',
    })
  })

  it('mostra pré-requisitos pendentes como "recomendado estudar antes" sem bloquear', async () => {
    const topic = await h.alice.rpc<Json>('get_topic', { p_slug: 'b' })
    expect(topic.recommendedFirst).toEqual([
      { slug: 'a', title: 'Tópico a', status: 'not_started' },
    ])

    // marcar b com a pendente é permitido
    const res = await h.alice.rpc<Json>('set_checklist_item', {
      p_slug: 'b',
      p_key: 'b-1',
      p_checked: true,
    })
    expect(res.data.status).toBe('studying')
  })

  it('retorna recursos, checklist e XP no detalhe', async () => {
    const topic = await h.alice.rpc<Json>('get_topic', { p_slug: 'a' })
    expect(topic.checklist).toHaveLength(3)
    expect(topic.resources[1]).toEqual({ name: 'Livro X', url: null })
    expect(topic.xp).toBe(10)
    expect(topic.projects).toEqual([])
    expect((await h.alice.rpc<Json>('get_topic', { p_slug: 'b' })).projects).toEqual([
      { slug: 'p1', title: 'Projeto 1' },
    ])
  })

  it('atualiza notas, evidência e status (e limpa a evidência com string vazia)', async () => {
    const { data } = await h.alice.rpc<Json>('update_topic_progress', {
      p_slug: 'a',
      p_patch: {
        notes: '# Anotações\n\n- ok',
        evidenceUrl: 'https://github.com/vitto2/exemplo',
        status: 'studying',
      },
    })
    expect(data).toMatchObject({
      notes: '# Anotações\n\n- ok',
      evidenceUrl: 'https://github.com/vitto2/exemplo',
      status: 'studying',
    })
    const cleared = await h.alice.rpc<Json>('update_topic_progress', {
      p_slug: 'a',
      p_patch: { evidenceUrl: '' },
    })
    expect(cleared.data.evidenceUrl).toBeNull()
    expect(cleared.data.notes).toBe('# Anotações\n\n- ok') // só as chaves enviadas mudam
  })

  it('valida entradas no servidor (422 com erros por campo)', async () => {
    const bad = await h.alice
      .rpc('update_topic_progress', {
        p_slug: 'a',
        p_patch: { evidenceUrl: 'javascript:alert(1)' },
      })
      .catch((e) => e)
    expect(bad).toMatchObject({ code: 'PT422', hint: 'validation_failed' })
    expect(JSON.parse(bad.detail)).toHaveProperty('evidenceUrl')

    await expect(
      h.alice.rpc('update_topic_progress', { p_slug: 'a', p_patch: { status: 'completed' } }),
    ).rejects.toMatchObject({ code: 'PT422' })
    await expect(
      h.alice.rpc('update_topic_progress', { p_slug: 'a', p_patch: { notes: 'x'.repeat(20001) } }),
    ).rejects.toMatchObject({ code: 'PT422' })
  })

  it('retorna 404 padronizado', async () => {
    await expect(h.alice.rpc('get_topic', { p_slug: 'nao-existe' })).rejects.toMatchObject({
      code: 'PT404',
      hint: 'not_found',
      message: 'Tópico não encontrado(a).',
    })
    await expect(
      h.alice.rpc('set_checklist_item', { p_slug: 'a', p_key: 'xxx', p_checked: true }),
    ).rejects.toMatchObject({ code: 'PT404' })
  })
})

describe('conclusão e XP', () => {
  it('exige o checklist completo para concluir', async () => {
    await h.alice.rpc('set_checklist_item', { p_slug: 'a', p_key: 'a-1', p_checked: true })
    await expect(h.alice.rpc('complete_topic', { p_slug: 'a' })).rejects.toMatchObject({
      code: 'PT409',
      hint: 'checklist_incomplete',
    })
  })

  it('conclui, concede dificuldade x 10 de XP e agenda 7/30/90 dias', async () => {
    await checkAll(h.alice, 'b')
    const { data, profile } = await h.alice.rpc<Json>('complete_topic', { p_slug: 'b' })
    expect(data.status).toBe('completed')
    expect(profile.xp.total).toBe(30)
    expect(profile.xp.breakdown.topics).toBe(30)
    expect(reviewsOf(data)).toEqual([
      [7, '2026-03-17'],
      [30, '2026-04-09'],
      [90, '2026-06-08'],
    ])
  })

  it('concluir é idempotente (não duplica XP nem revisões)', async () => {
    await checkAll(h.alice, 'a')
    await h.alice.rpc('complete_topic', { p_slug: 'a' })
    const second = await h.alice.rpc<Json>('complete_topic', { p_slug: 'a' })
    expect(second.profile.xp.total).toBe(10)
    expect(second.data.reviews).toHaveLength(3)
  })

  it('desmarcar um item de tópico concluído reabre o tópico e desfaz o XP e as revisões', async () => {
    await checkAll(h.alice, 'a')
    await h.alice.rpc('complete_topic', { p_slug: 'a' })
    const { data, profile } = await h.alice.rpc<Json>('set_checklist_item', {
      p_slug: 'a',
      p_key: 'a-2',
      p_checked: false,
    })
    expect(data.status).toBe('studying')
    expect(data.reviews).toHaveLength(0)
    expect(profile.xp.total).toBe(0)
  })

  it('"Já domino" conclui tudo de uma vez e agenda apenas a revisão de 90 dias', async () => {
    const { data, profile } = await h.alice.rpc<Json>('master_topic', { p_slug: 'c' })
    expect(data).toMatchObject({ status: 'completed', masteredDirectly: true, checklistChecked: 3 })
    expect(reviewsOf(data)).toEqual([[90, '2026-06-08']])
    expect(profile.xp.total).toBe(40)
  })

  it('reabrir desfaz o XP', async () => {
    await h.alice.rpc('master_topic', { p_slug: 'c' })
    const { data, profile } = await h.alice.rpc<Json>('reopen_topic', { p_slug: 'c' })
    expect(data.status).toBe('studying')
    expect(data.masteredDirectly).toBe(false)
    expect(profile.xp.total).toBe(0)
  })

  it('voltar o status para "estudando" via update_topic_progress também reabre', async () => {
    await h.alice.rpc('master_topic', { p_slug: 'a' })
    const { data, profile } = await h.alice.rpc<Json>('update_topic_progress', {
      p_slug: 'a',
      p_patch: { status: 'studying' },
    })
    expect(data.status).toBe('studying')
    expect(profile.xp.total).toBe(0)
  })

  it('tópico concluído conta no progresso por trilha e geral', async () => {
    await h.alice.rpc('master_topic', { p_slug: 'a' })
    const tracks = await h.alice.rpc<Json[]>('list_tracks')
    expect(tracks[0]).toMatchObject({ completedTopics: 1, percent: 25, earnedXp: 10, totalXp: 130 })
    const profile = await h.alice.rpc<Json>('get_profile')
    expect(profile.overall).toEqual({ completedTopics: 1, totalTopics: 5, percent: 20 })
  })

  it('o fuso do usuário define a data das revisões', async () => {
    await h.alice.rpc('update_settings', { p_patch: { timezone: 'UTC' } })
    await h.setNow('2026-03-10T02:30:00Z') // 23:30 do dia 9 em São Paulo, 02:30 do dia 10 em UTC
    const { data } = await h.alice.rpc<Json>('master_topic', { p_slug: 'a' })
    expect(reviewsOf(data)).toEqual([[90, '2026-06-08']]) // 10/03 + 90 dias (UTC)

    await h.alice.rpc('reopen_topic', { p_slug: 'a' })
    await h.alice.rpc('update_settings', { p_patch: { timezone: 'America/Sao_Paulo' } })
    const again = await h.alice.rpc<Json>('master_topic', { p_slug: 'a' })
    expect(reviewsOf(again.data)).toEqual([[90, '2026-06-07']]) // 09/03 + 90 dias (São Paulo)
  })
})

describe('revisão espaçada', () => {
  it('fila do dia traz revisões vencidas e concluir rende 25% do XP do tópico', async () => {
    await checkAll(h.alice, 'c') // dificuldade 4: 40 XP; revisão = 10 XP
    await h.alice.rpc('complete_topic', { p_slug: 'c' })

    expect(await h.alice.rpc<Json[]>('list_reviews')).toHaveLength(0)

    await h.setNow('2026-03-17T15:00:00Z') // 7 dias depois
    const today = await h.alice.rpc<Json[]>('list_reviews')
    expect(today).toHaveLength(1)
    expect(today[0]).toMatchObject({ intervalDays: 7, xp: 10, overdue: false })
    expect(today[0].topic).toEqual({ slug: 'c', title: 'Tópico c' })

    const done = await h.alice.rpc<Json>('complete_review', { p_id: today[0].id })
    expect(done.profile.xp.total).toBe(50)
    expect(done.profile.xp.breakdown.reviews).toBe(10)
    expect(await h.alice.rpc<Json[]>('list_reviews')).toHaveLength(0)

    // idempotente e reversível
    expect(
      (await h.alice.rpc<Json>('complete_review', { p_id: today[0].id })).profile.xp.total,
    ).toBe(50)
    expect((await h.alice.rpc<Json>('undo_review', { p_id: today[0].id })).profile.xp.total).toBe(
      40,
    )
  })

  it('marca revisões atrasadas', async () => {
    await h.alice.rpc('master_topic', { p_slug: 'a' }) // revisão de 90 dias
    await h.setNow('2026-07-01T15:00:00Z')
    const [review] = await h.alice.rpc<Json[]>('list_reviews')
    expect(review.overdue).toBe(true)
  })

  it('lista as próximas, concluídas e todas; rejeita período inválido e revisão inexistente', async () => {
    await checkAll(h.alice, 'a')
    await h.alice.rpc('complete_topic', { p_slug: 'a' })
    expect(await h.alice.rpc<Json[]>('list_reviews', { p_scope: 'upcoming' })).toHaveLength(3)
    expect(await h.alice.rpc<Json[]>('list_reviews', { p_scope: 'completed' })).toHaveLength(0)
    expect(await h.alice.rpc<Json[]>('list_reviews', { p_scope: 'all' })).toHaveLength(3)
    await expect(h.alice.rpc('list_reviews', { p_scope: 'xyz' })).rejects.toMatchObject({
      code: 'PT422',
    })
    await expect(h.alice.rpc('complete_review', { p_id: 999999 })).rejects.toMatchObject({
      code: 'PT404',
    })
  })
})
