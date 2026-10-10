import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createHarness, type Harness, type Json } from '../support/harness'

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

const milestone = (key: string, status = 'completed') =>
  h.alice.rpc<Json>('set_milestone_status', { p_slug: 'p1', p_key: key, p_status: status })

describe('projetos', () => {
  it('lista o catálogo e o detalhe com critérios de aceite', async () => {
    const [project] = await h.alice.rpc<Json[]>('list_projects')
    expect(project).toMatchObject({
      slug: 'p1',
      status: 'not_started',
      milestonesTotal: 3,
      totalXp: 90 + 200,
    })
    const detail = await h.alice.rpc<Json>('get_project', { p_slug: 'p1' })
    expect(detail.milestones[0]).toMatchObject({
      key: 'm1',
      acceptanceCriteria: ['Critério 1'],
      status: 'pending',
    })
    expect(detail.topics).toEqual([{ slug: 'b', title: 'Tópico b', status: 'not_started' }])
  })

  it('cada etapa concluída rende o XP definido nela', async () => {
    const { data, profile } = await milestone('m1')
    expect(profile.xp.total).toBe(20)
    expect(data).toMatchObject({ status: 'in_progress', milestonesCompleted: 1, earnedXp: 20 })
    expect((await milestone('m2')).profile.xp.total).toBe(50)
  })

  it('finalizar rende 100 XP; repositório e deploy somam +50 cada', async () => {
    await milestone('m1')
    await milestone('m2')
    const finished = await milestone('m3')
    expect(finished.data.status).toBe('finished')
    expect(finished.profile.xp.total).toBe(90 + 100)

    const withRepo = await h.alice.rpc<Json>('update_project_links', {
      p_slug: 'p1',
      p_patch: { repositoryUrl: 'https://github.com/vitto2/p1' },
    })
    expect(withRepo.profile.xp.total).toBe(90 + 150)

    const withDeploy = await h.alice.rpc<Json>('update_project_links', {
      p_slug: 'p1',
      p_patch: { deployUrl: 'https://p1.example.com' },
    })
    expect(withDeploy.profile.xp.total).toBe(90 + 200)
    expect(withDeploy.data.bonus).toEqual({
      finished: true,
      finishXp: 100,
      repositoryXp: 50,
      deployXp: 50,
      total: 200,
    })
    expect(withDeploy.profile.xp.breakdown).toMatchObject({ milestones: 90, projects: 200 })
  })

  it('desmarcar uma etapa desfaz o XP da etapa e o bônus do projeto', async () => {
    for (const key of ['m1', 'm2', 'm3']) await milestone(key)
    const { data, profile } = await milestone('m3', 'pending')
    expect(profile.xp.total).toBe(50)
    expect(data.status).toBe('in_progress')
    expect(data.bonus.total).toBe(0)
  })

  it('links sozinhos não geram bônus sem o projeto finalizado', async () => {
    const { data, profile } = await h.alice.rpc<Json>('update_project_links', {
      p_slug: 'p1',
      p_patch: { repositoryUrl: 'https://github.com/vitto2/p1' },
    })
    expect(profile.xp.total).toBe(0)
    expect(data.repositoryUrl).toBe('https://github.com/vitto2/p1')
    expect(data.status).toBe('in_progress')
  })

  it('valida links, status e etapas inexistentes', async () => {
    const call = (fn: string, args: Record<string, unknown>) => h.alice.rpc(fn, args)
    await expect(
      call('update_project_links', { p_slug: 'p1', p_patch: { deployUrl: 'ftp://x' } }),
    ).rejects.toMatchObject({ code: 'PT422' })
    await expect(
      call('set_milestone_status', { p_slug: 'p1', p_key: 'zzz', p_status: 'completed' }),
    ).rejects.toMatchObject({ code: 'PT404' })
    await expect(
      call('set_milestone_status', { p_slug: 'p1', p_key: 'm1', p_status: 'done' }),
    ).rejects.toMatchObject({ code: 'PT422' })
    await expect(call('get_project', { p_slug: 'nada' })).rejects.toMatchObject({ code: 'PT404' })
  })
})

describe('nível de gamificação e de carreira', () => {
  it('calcula o nível a partir do XP derivado (100 x N^1,5 por nível)', async () => {
    await h.alice.rpc('master_topic', { p_slug: 'd' }) // 50 XP
    await milestone('m1')
    const { profile } = await milestone('m2') // +50 => 100 XP
    expect(profile.xp).toMatchObject({ total: 100, level: 2, xpIntoLevel: 0, xpForNextLevel: 283 })
  })

  it('evolui o nível de carreira nas trilhas obrigatórias (40% / 60% / 80%)', async () => {
    const career = async () => (await h.alice.rpc<Json>('get_profile')).career
    expect((await career()).level).toBe('beginner')

    // o tópico "e" é de trilha opcional e não conta
    await h.alice.rpc('master_topic', { p_slug: 'e' })
    expect((await career()).level).toBe('beginner')

    // a (iniciante): 1 de 2 tópicos até júnior = 50% >= 40%
    await h.alice.rpc('master_topic', { p_slug: 'a' })
    const junior = await career()
    expect(junior.level).toBe('junior')
    expect(junior.next).toMatchObject({ level: 'mid', requiredPercent: 60 })

    // a, b, c = 3 de 3 até pleno => pleno; sênior exige 80% de 4 tópicos
    await h.alice.rpc('master_topic', { p_slug: 'b' })
    await h.alice.rpc('master_topic', { p_slug: 'c' })
    expect((await career()).level).toBe('mid')

    await h.alice.rpc('master_topic', { p_slug: 'd' })
    const senior = await career()
    expect(senior.level).toBe('senior')
    expect(senior.next).toBeNull()
  })

  it('níveis de carreira são sequenciais (não basta concluir só os de cima)', async () => {
    await h.alice.rpc('master_topic', { p_slug: 'c' })
    await h.alice.rpc('master_topic', { p_slug: 'd' })
    const { career } = await h.alice.rpc<Json>('get_profile')
    expect(career.level).toBe('beginner')
    expect(career.progress.map((p: Json) => p.reached)).toEqual([false, false, false])
  })

  it('funções puras: XP por dificuldade, revisão e custo de nível', async () => {
    const rows = await h.admin.query<Json>(
      `select app.topic_xp(d) as topic, app.review_xp(d) as review from generate_series(1, 5) d order by d`,
    )
    expect(rows.map((r) => r.topic)).toEqual([10, 20, 30, 40, 50])
    expect(rows.map((r) => r.review)).toEqual([3, 5, 8, 10, 13]) // 25%, arredondado para cima em .5
    const costs = await h.admin.query<Json>(
      `select n, app.xp_to_complete_level(n) as cost from generate_series(1, 4) n order by n`,
    )
    expect(costs.map((c) => c.cost)).toEqual([100, 283, 520, 800])
    expect((await h.admin.query<Json>(`select app.level_info(99) as l`))[0].l).toMatchObject({
      level: 1,
    })
    expect((await h.admin.query<Json>(`select app.level_info(383) as l`))[0].l).toMatchObject({
      level: 3,
      xpIntoLevel: 0,
    })
  })
})

describe('diário, streak e meta semanal', () => {
  it('registra sessões e calcula streak e meta semanal no fuso configurado', async () => {
    await h.setNow('2026-03-11T15:00:00Z') // quarta-feira
    for (const studiedOn of ['2026-03-09', '2026-03-10']) {
      await h.alice.rpc('create_study_session', { p_input: { studiedOn, durationMinutes: 30 } })
    }
    const today = await h.alice.rpc<Json>('create_study_session', {
      p_input: { durationMinutes: 45, note: 'Vue Router' },
    })
    expect(today.data).toMatchObject({
      studiedOn: '2026-03-11',
      durationMinutes: 45,
      note: 'Vue Router',
    })
    expect(today.profile.streak).toEqual({
      current: 3,
      longest: 3,
      studiedToday: true,
      weeklySessions: 3,
      weeklyGoal: 5,
    })
  })

  it('usa o fuso configurado para definir "hoje"', async () => {
    await h.setNow('2026-03-10T02:30:00Z') // 23:30 do dia 9 em São Paulo
    const first = await h.alice.rpc<Json>('create_study_session', {
      p_input: { durationMinutes: 20 },
    })
    expect(first.data.studiedOn).toBe('2026-03-09')

    await h.alice.rpc('update_settings', { p_patch: { timezone: 'UTC' } })
    const utc = await h.alice.rpc<Json>('create_study_session', {
      p_input: { durationMinutes: 20 },
    })
    expect(utc.data.studiedOn).toBe('2026-03-10')
  })

  it('o streak continua vivo se estudou ontem, e quebrar o streak não tira XP', async () => {
    await h.alice.rpc('master_topic', { p_slug: 'a' })
    await h.alice.rpc('create_study_session', {
      p_input: { studiedOn: '2026-03-09', durationMinutes: 30 },
    })
    expect((await h.alice.rpc<Json>('get_profile')).streak).toMatchObject({
      current: 1,
      studiedToday: false,
    })

    await h.setNow('2026-03-20T15:00:00Z')
    const { streak, xp } = await h.alice.rpc<Json>('get_profile')
    expect(streak.current).toBe(0)
    expect(streak.longest).toBe(1)
    expect(xp.total).toBe(10)
  })

  it('mantém o maior streak mesmo depois de uma pausa', async () => {
    await h.setNow('2026-03-11T15:00:00Z')
    for (const studiedOn of ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-10']) {
      await h.alice.rpc('create_study_session', { p_input: { studiedOn, durationMinutes: 10 } })
    }
    expect((await h.alice.rpc<Json>('get_profile')).streak).toMatchObject({
      current: 1,
      longest: 3,
    })
  })

  it('lista, edita e remove sessões; valida entradas', async () => {
    const created = await h.alice.rpc<Json>('create_study_session', {
      p_input: { durationMinutes: 30, topicSlug: 'a' },
    })
    const id = created.data.id
    expect(created.data.topic).toEqual({ slug: 'a', title: 'Tópico a' })

    const updated = await h.alice.rpc<Json>('update_study_session', {
      p_id: id,
      p_input: { durationMinutes: 50, note: 'Revisado' },
    })
    expect(updated.data).toMatchObject({ durationMinutes: 50, note: 'Revisado', topic: null })

    const list = await h.alice.rpc<Json>('list_study_sessions', { p_per_page: 10 })
    expect(list.meta).toEqual({ page: 1, perPage: 10, total: 1 })
    expect(list.data[0].id).toBe(id)

    const invalid = (input: Json) => h.alice.rpc('create_study_session', { p_input: input })
    await expect(invalid({ durationMinutes: 0 })).rejects.toMatchObject({ code: 'PT422' })
    await expect(invalid({ durationMinutes: 10, topicSlug: 'zzz' })).rejects.toMatchObject({
      code: 'PT422',
    })
    await expect(invalid({ durationMinutes: 10, studiedOn: '2030-01-01' })).rejects.toMatchObject({
      code: 'PT422',
      message: 'A data da sessão não pode estar no futuro.',
    })
    await expect(invalid({ durationMinutes: 10, studiedOn: 'amanha' })).rejects.toMatchObject({
      code: 'PT422',
    })
    await expect(invalid({ durationMinutes: 10, note: 'x'.repeat(501) })).rejects.toMatchObject({
      code: 'PT422',
    })

    const removed = await h.alice.rpc<Json>('delete_study_session', { p_id: id })
    expect(removed.profile.streak.weeklySessions).toBe(0)
    await expect(h.alice.rpc('delete_study_session', { p_id: id })).rejects.toMatchObject({
      code: 'PT404',
    })
    await expect(
      h.alice.rpc('update_study_session', { p_id: id, p_input: { durationMinutes: 5 } }),
    ).rejects.toMatchObject({ code: 'PT404' })
  })

  it('pagina o histórico (mais recentes primeiro)', async () => {
    for (const studiedOn of ['2026-03-01', '2026-03-05', '2026-03-03']) {
      await h.alice.rpc('create_study_session', { p_input: { studiedOn, durationMinutes: 10 } })
    }
    const page1 = await h.alice.rpc<Json>('list_study_sessions', { p_page: 1, p_per_page: 2 })
    expect(page1.data.map((s: Json) => s.studiedOn)).toEqual(['2026-03-05', '2026-03-03'])
    const page2 = await h.alice.rpc<Json>('list_study_sessions', { p_page: 2, p_per_page: 2 })
    expect(page2.data.map((s: Json) => s.studiedOn)).toEqual(['2026-03-01'])
    expect(page2.meta.total).toBe(3)
    await expect(h.alice.rpc('list_study_sessions', { p_page: 0 })).rejects.toMatchObject({
      code: 'PT422',
    })
  })

  it('monta o dashboard com radar por trilha e sessões por semana', async () => {
    await h.setNow('2026-03-11T15:00:00Z')
    await h.alice.rpc('master_topic', { p_slug: 'a' })
    await h.alice.rpc('create_study_session', { p_input: { durationMinutes: 30 } })
    await h.alice.rpc('create_study_session', {
      p_input: { durationMinutes: 15, studiedOn: '2026-03-03' },
    })

    const dashboard = await h.alice.rpc<Json>('get_dashboard')
    expect(dashboard.radar[0]).toEqual({ trackSlug: 'core', title: 'Core', percent: 25 })
    expect(dashboard.weeks).toHaveLength(12)
    expect(dashboard.weeks.at(-1)).toEqual({ weekStart: '2026-03-09', sessions: 1, minutes: 30 })
    expect(dashboard.weeks.at(-2)).toEqual({ weekStart: '2026-03-02', sessions: 1, minutes: 15 })
    expect(dashboard.totals).toEqual({ sessions: 2, minutes: 45 })
    expect(dashboard.profile.xp.total).toBe(10)
  })
})

describe('configurações', () => {
  it('atualiza e valida fuso e meta semanal', async () => {
    expect(await h.alice.rpc('get_settings')).toEqual({
      timezone: 'America/Sao_Paulo',
      weeklyGoal: 5,
    })

    const ok = await h.alice.rpc<Json>('update_settings', { p_patch: { weeklyGoal: 3 } })
    expect(ok).toEqual({ timezone: 'America/Sao_Paulo', weeklyGoal: 3 })
    expect((await h.alice.rpc<Json>('get_profile')).streak.weeklyGoal).toBe(3)

    await expect(
      h.alice.rpc('update_settings', { p_patch: { timezone: 'Marte/Olympus' } }),
    ).rejects.toMatchObject({ code: 'PT422' })
    await expect(
      h.alice.rpc('update_settings', { p_patch: { weeklyGoal: 0 } }),
    ).rejects.toMatchObject({
      code: 'PT422',
    })
    // só as chaves enviadas mudam
    expect(await h.alice.rpc('update_settings', { p_patch: { timezone: 'UTC' } })).toEqual({
      timezone: 'UTC',
      weeklyGoal: 3,
    })
  })
})
