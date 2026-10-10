import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ALICE, checkAll, createHarness, type Harness, type Json } from '../support/harness'

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

describe('permissões das funções da API', () => {
  it('nenhuma função do esquema public é executável por anon; todas são por authenticated', async () => {
    const rows = await h.admin.query<Json>(`
      select p.oid::regprocedure::text as signature,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as authenticated
        from pg_proc p
       where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'`)
    expect(rows.length).toBeGreaterThanOrEqual(25)
    expect(rows.filter((r) => r.anon).map((r) => r.signature)).toEqual([])
    expect(rows.filter((r) => !r.authenticated).map((r) => r.signature)).toEqual([])
  })

  it('anon não consegue chamar a API nem ler as tabelas', async () => {
    await expect(h.anon.rpc('get_profile')).rejects.toMatchObject({ code: '42501' })
    await expect(h.anon.rpc('list_tracks')).rejects.toMatchObject({ code: '42501' })
    await expect(h.anon.query('select * from app.tracks')).rejects.toMatchObject({ code: '42501' })
  })

  it('token sem usuário (sem "sub") recebe 401 padronizado', async () => {
    await expect(h.nobody.rpc('get_profile')).rejects.toMatchObject({
      code: 'PT401',
      hint: 'unauthenticated',
    })
    await expect(h.nobody.rpc('master_topic', { p_slug: 'a' })).rejects.toMatchObject({
      code: 'PT401',
    })
  })

  it('usuários logados não executam a carga de conteúdo nem as funções internas de escrita', async () => {
    await expect(h.alice.query(`select app.sync_content('{}'::jsonb)`)).rejects.toMatchObject({
      code: '42501',
    })
  })
})

describe('isolamento entre usuários (RLS)', () => {
  it('o progresso de um usuário é invisível para outro', async () => {
    await h.alice.rpc('master_topic', { p_slug: 'a' })
    await h.alice.rpc('create_study_session', { p_input: { durationMinutes: 30 } })
    await h.alice.rpc('update_settings', { p_patch: { weeklyGoal: 9 } })

    const bob = await h.bob.rpc<Json>('get_profile')
    expect(bob.xp.total).toBe(0)
    expect(bob.streak.weeklyGoal).toBe(5)
    expect((await h.bob.rpc<Json>('get_topic', { p_slug: 'a' })).status).toBe('not_started')
    expect((await h.bob.rpc<Json>('list_study_sessions')).data).toEqual([])
    expect(await h.bob.rpc<Json[]>('list_reviews', { p_scope: 'all' })).toEqual([])
    expect((await h.bob.rpc<Json>('export_backup')).topics).toEqual([])
  })

  it('consultas diretas só enxergam as próprias linhas', async () => {
    await h.alice.rpc('master_topic', { p_slug: 'a' })
    await checkAll(h.bob, 'e')

    expect(await h.admin.query('select user_id from app.topic_progress')).toHaveLength(2)
    const mine = await h.bob.query<Json>('select user_id, topic_id from app.topic_progress')
    expect(mine).toHaveLength(1)
    expect(mine[0].user_id).not.toBe(ALICE)
    expect(await h.bob.query('select * from app.reviews')).toEqual([]) // revisões são da Alice
  })

  it('um usuário não escreve nas linhas de outro', async () => {
    await expect(
      h.bob.query(
        `insert into app.study_sessions (user_id, studied_on, duration_minutes) values ('${ALICE}', '2026-03-10', 10)`,
      ),
    ).rejects.toMatchObject({ code: '42501' })

    await h.alice.rpc('master_topic', { p_slug: 'a' })
    const updated = await h.bob.query<Json>(
      `update app.topic_progress set notes = 'invasor' returning 1`,
    )
    expect(updated).toEqual([]) // RLS filtra: nenhuma linha da Alice é tocada
    expect((await h.alice.rpc<Json>('get_topic', { p_slug: 'a' })).notes).toBe('')
  })

  it('ids de outro usuário respondem 404 (revisões e sessões)', async () => {
    await h.alice.rpc('master_topic', { p_slug: 'a' })
    const [review] = await h.alice.rpc<Json[]>('list_reviews', { p_scope: 'all' })
    const session = await h.alice.rpc<Json>('create_study_session', {
      p_input: { durationMinutes: 20 },
    })

    await expect(h.bob.rpc('complete_review', { p_id: review.id })).rejects.toMatchObject({
      code: 'PT404',
    })
    await expect(h.bob.rpc('undo_review', { p_id: review.id })).rejects.toMatchObject({
      code: 'PT404',
    })
    await expect(
      h.bob.rpc('delete_study_session', { p_id: session.data.id }),
    ).rejects.toMatchObject({
      code: 'PT404',
    })
    await expect(
      h.bob.rpc('update_study_session', { p_id: session.data.id, p_input: { durationMinutes: 1 } }),
    ).rejects.toMatchObject({ code: 'PT404' })
    // nada mudou para a Alice
    expect((await h.alice.rpc<Json>('list_reviews', { p_scope: 'all' }))[0].completedAt).toBeNull()
    expect((await h.alice.rpc<Json>('list_study_sessions')).meta.total).toBe(1)
  })
})

describe('conteúdo é somente leitura para o app', () => {
  it('usuários logados leem o conteúdo, mas não o alteram', async () => {
    expect(await h.alice.query('select slug from app.topics')).toHaveLength(5)
    await expect(
      h.alice.query(`insert into app.tracks (slug, title) values ('hack', 'Hack')`),
    ).rejects.toMatchObject({ code: '42501' })
    await expect(h.alice.query(`update app.topics set difficulty = 1`)).rejects.toMatchObject({
      code: '42501',
    })
    await expect(h.alice.query(`delete from app.milestones`)).rejects.toMatchObject({
      code: '42501',
    })
  })

  it('todas as tabelas do esquema app têm RLS ligada', async () => {
    const rows = await h.admin.query<Json>(`
      select c.relname from pg_class c
       where c.relnamespace = 'app'::regnamespace and c.relkind = 'r' and not c.relrowsecurity`)
    expect(rows).toEqual([])
  })
})
