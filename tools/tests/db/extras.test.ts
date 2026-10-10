import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { checkAll, createHarness, type Harness, type Json } from '../support/harness'

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

describe('grafo de pré-requisitos', () => {
  it('lista nós e arestas e marca bloqueados/desbloqueados', async () => {
    const graph = await h.alice.rpc<Json>('get_graph')
    const nodes = new Map<string, Json>(graph.nodes.map((n: Json) => [n.slug, n]))
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
      ]),
    )
    expect(nodes.get('a')?.unlocked).toBe(true) // sem pré-requisitos
    expect(nodes.get('b')).toMatchObject({ unlocked: false, blockedBy: ['a'] })
  })

  it('desbloqueia o tópico quando o pré-requisito é concluído (sem nunca impedir a marcação)', async () => {
    await h.alice.rpc('master_topic', { p_slug: 'a' })
    const graph = await h.alice.rpc<Json>('get_graph')
    const node = (slug: string) => graph.nodes.find((n: Json) => n.slug === slug)
    expect(node('b')).toMatchObject({ unlocked: true, blockedBy: [] })
    expect(node('c').unlocked).toBe(false)
    expect((await h.alice.rpc<Json>('master_topic', { p_slug: 'c' })).data.status).toBe('completed')
  })
})

describe('backup e restauração', () => {
  async function seedProgress(client = h.alice) {
    await client.rpc('set_checklist_item', { p_slug: 'a', p_key: 'a-1', p_checked: true })
    await client.rpc('master_topic', { p_slug: 'b' })
    await client.rpc('update_topic_progress', {
      p_slug: 'a',
      p_patch: { notes: '# Minhas notas', evidenceUrl: 'https://example.com/e' },
    })
    await client.rpc('set_milestone_status', { p_slug: 'p1', p_key: 'm1', p_status: 'completed' })
    await client.rpc('update_project_links', {
      p_slug: 'p1',
      p_patch: { deployUrl: 'https://p1.example.com' },
    })
    await client.rpc('create_study_session', {
      p_input: { durationMinutes: 40, topicSlug: 'a', note: 'Estudo' },
    })
    await client.rpc('update_settings', { p_patch: { weeklyGoal: 4 } })
  }

  it('exporta o progresso por slug e restaura em um banco novo, preservando o XP', async () => {
    await seedProgress()
    const before = await h.alice.rpc<Json>('get_profile')
    const backup = await h.alice.rpc<Json>('export_backup')

    expect(backup.version).toBe(1)
    expect(backup.topics.find((t: Json) => t.slug === 'a')).toMatchObject({
      notes: '# Minhas notas',
      checked: ['a-1'],
    })
    expect(backup.settings).toEqual({ timezone: 'America/Sao_Paulo', weeklyGoal: 4 })

    // banco novo (mesmo conteúdo, sem progresso) recebe o backup
    const other = await createHarness()
    try {
      await other.begin()
      expect((await other.alice.rpc<Json>('get_profile')).xp.total).toBe(0)
      const restored = await other.alice.rpc<Json>('import_backup', { p_backup: backup })
      expect(restored.data.skipped).toEqual([])
      expect(restored.data.imported).toMatchObject({ topics: 2, projects: 1, sessions: 1 })

      const after = await other.alice.rpc<Json>('get_profile')
      expect(after.xp.total).toBe(before.xp.total)
      expect(after.streak.weeklyGoal).toBe(4)
      expect(await other.alice.rpc('get_topic', { p_slug: 'a' })).toMatchObject({
        notes: '# Minhas notas',
        checklistChecked: 1,
      })
      expect((await other.alice.rpc<Json>('get_project', { p_slug: 'p1' })).deployUrl).toBe(
        'https://p1.example.com',
      )
      expect((await other.alice.rpc<Json>('list_study_sessions')).data[0]).toMatchObject({
        note: 'Estudo',
      })
      // exportar de novo gera o mesmo progresso
      const again = await other.alice.rpc<Json>('export_backup')
      expect({ ...again, exportedAt: null }).toEqual({ ...backup, exportedAt: null })
    } finally {
      await other.rollback()
      await other.db.close()
    }
  })

  it('restaurar substitui o progresso atual e ignora itens que não existem mais', async () => {
    await h.alice.rpc('master_topic', { p_slug: 'd' }) // será substituído
    const backup = {
      version: 1,
      exportedAt: '2026-03-01T00:00:00.000Z',
      topics: [
        {
          slug: 'a',
          status: 'studying',
          notes: '',
          evidenceUrl: null,
          startedAt: '2026-03-01T00:00:00.000Z',
          completedAt: null,
          masteredDirectly: false,
          checked: ['a-1', 'item-que-sumiu'],
          reviews: [],
        },
        {
          slug: 'topico-removido',
          status: 'completed',
          notes: '',
          evidenceUrl: null,
          startedAt: null,
          completedAt: null,
          masteredDirectly: false,
          checked: [],
          reviews: [],
        },
      ],
      projects: [],
      sessions: [],
    }
    const { data, profile } = await h.alice.rpc<Json>('import_backup', { p_backup: backup })
    expect(data.skipped).toEqual([
      'item "item-que-sumiu" do tópico "a"',
      'tópico "topico-removido"',
    ])
    expect(profile.xp.total).toBe(0) // "d" deixou de estar concluído
    expect((await h.alice.rpc<Json>('get_topic', { p_slug: 'a' })).checklistChecked).toBe(1)
  })

  it('rejeita backup inválido sem alterar nada (tudo ou nada)', async () => {
    await h.alice.rpc('master_topic', { p_slug: 'a' })

    await expect(h.alice.rpc('import_backup', { p_backup: { version: 2 } })).rejects.toMatchObject({
      code: 'PT422',
    })

    // dado corrompido no meio do arquivo: nada é aplicado, o progresso atual fica intacto
    const corrupted = {
      version: 1,
      exportedAt: '2026-03-01T00:00:00.000Z',
      topics: [
        {
          slug: 'b',
          status: 'completed',
          notes: '',
          evidenceUrl: null,
          startedAt: null,
          completedAt: null,
          masteredDirectly: false,
          checked: [],
          reviews: [],
        },
        {
          slug: 'c',
          status: 'status-invalido',
          notes: '',
          evidenceUrl: null,
          startedAt: null,
          completedAt: null,
          masteredDirectly: false,
          checked: [],
          reviews: [],
        },
      ],
      projects: [],
      sessions: [],
    }
    await expect(h.alice.rpc('import_backup', { p_backup: corrupted })).rejects.toMatchObject({
      code: 'PT422',
    })
    const profile = await h.alice.rpc<Json>('get_profile')
    expect(profile.xp.total).toBe(10)
    expect((await h.alice.rpc<Json>('get_topic', { p_slug: 'a' })).status).toBe('completed')
  })

  it('restaurar o backup de um usuário não mexe nos dados de outro', async () => {
    await seedProgress(h.alice)
    await checkAll(h.bob, 'e')
    const backup = await h.alice.rpc<Json>('export_backup')
    await h.bob.rpc('import_backup', { p_backup: backup })
    expect((await h.alice.rpc<Json>('get_profile')).xp.total).toBe(
      (await h.bob.rpc<Json>('get_profile')).xp.total,
    )
    // e a recíproca: Alice segue com os próprios dados
    expect((await h.alice.rpc<Json>('get_topic', { p_slug: 'e' })).checklistChecked).toBe(0)
  })
})

afterAll(async () => {
  await h.db.close()
})
