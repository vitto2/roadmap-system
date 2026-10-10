import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  dashboardSchema,
  graphSchema,
  profileSchema,
  projectDetailSchema,
  projectSummarySchema,
  reviewSchema,
  settingsSchema,
  studySessionSchema,
  topicDetailSchema,
  topicSummarySchema,
  trackSummarySchema,
} from '../../src/dto'
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
afterAll(async () => {
  await h.db.close()
})

/**
 * O contrato é exato: o JSON do banco precisa ser idêntico ao que o schema Zod (e, por espelhamento,
 * frontend/src/api/types.ts) descreve — sem campos faltando nem sobrando.
 */
function expectContract(schema: z.ZodType, value: unknown) {
  const parsed = schema.parse(value)
  expect(JSON.parse(JSON.stringify(parsed))).toEqual(JSON.parse(JSON.stringify(value)))
}

const mutation = (data: z.ZodType) => z.object({ data, profile: profileSchema })

async function richState() {
  await h.alice.rpc('master_topic', { p_slug: 'a' })
  await checkAll(h.alice, 'b')
  await h.alice.rpc('complete_topic', { p_slug: 'b' })
  await h.alice.rpc('set_checklist_item', { p_slug: 'c', p_key: 'c-1', p_checked: true })
  await h.alice.rpc('update_topic_progress', {
    p_slug: 'c',
    p_patch: { notes: 'notas', evidenceUrl: 'https://example.com/c' },
  })
  await h.alice.rpc('set_milestone_status', { p_slug: 'p1', p_key: 'm1', p_status: 'completed' })
  await h.alice.rpc('set_milestone_status', { p_slug: 'p1', p_key: 'm2', p_status: 'in_progress' })
  await h.alice.rpc('update_project_links', {
    p_slug: 'p1',
    p_patch: { repositoryUrl: 'https://github.com/x/y' },
  })
  await h.alice.rpc('create_study_session', {
    p_input: { durationMinutes: 30, topicSlug: 'a', note: 'ok' },
  })
  await h.alice.rpc('create_study_session', { p_input: { durationMinutes: 15 } })
  await h.setNow('2026-03-20T15:00:00Z') // revisões de 7 dias atrasadas
}

describe.each([
  ['sem progresso', async () => {}],
  ['com bastante progresso', richState],
])('contrato JSON (%s)', (_name, prepare) => {
  beforeEach(async () => {
    await prepare()
  })

  it('perfil, configurações e dashboard', async () => {
    expectContract(profileSchema, await h.alice.rpc('get_profile'))
    expectContract(settingsSchema, await h.alice.rpc('get_settings'))
    expectContract(dashboardSchema, await h.alice.rpc('get_dashboard'))
  })

  it('trilhas e tópicos', async () => {
    expectContract(z.array(trackSummarySchema), await h.alice.rpc('list_tracks'))
    expectContract(z.array(topicSummarySchema), await h.alice.rpc('list_topics'))
    for (const slug of ['a', 'b', 'c', 'd', 'e']) {
      expectContract(topicDetailSchema, await h.alice.rpc('get_topic', { p_slug: slug }))
    }
  })

  it('projetos', async () => {
    expectContract(z.array(projectSummarySchema), await h.alice.rpc('list_projects'))
    expectContract(projectDetailSchema, await h.alice.rpc('get_project', { p_slug: 'p1' }))
  })

  it('revisões, diário e grafo', async () => {
    for (const scope of ['today', 'upcoming', 'pending', 'completed', 'all']) {
      expectContract(z.array(reviewSchema), await h.alice.rpc('list_reviews', { p_scope: scope }))
    }
    const sessions = await h.alice.rpc<Json>('list_study_sessions')
    expectContract(
      z.object({
        data: z.array(studySessionSchema),
        meta: z.object({ page: z.number(), perPage: z.number(), total: z.number() }),
      }),
      sessions,
    )
    expectContract(graphSchema, await h.alice.rpc('get_graph'))
  })
})

describe('contrato das mutações ({ data, profile })', () => {
  it('tópicos, projetos, revisões e diário', async () => {
    await checkAll(h.alice, 'a')
    expectContract(
      mutation(topicDetailSchema),
      await h.alice.rpc('set_checklist_item', { p_slug: 'a', p_key: 'a-1', p_checked: true }),
    )
    expectContract(
      mutation(topicDetailSchema),
      await h.alice.rpc('complete_topic', { p_slug: 'a' }),
    )
    expectContract(mutation(topicDetailSchema), await h.alice.rpc('reopen_topic', { p_slug: 'a' }))
    expectContract(mutation(topicDetailSchema), await h.alice.rpc('master_topic', { p_slug: 'a' }))
    expectContract(
      mutation(topicDetailSchema),
      await h.alice.rpc('update_topic_progress', { p_slug: 'a', p_patch: { notes: 'n' } }),
    )
    expectContract(
      mutation(projectDetailSchema),
      await h.alice.rpc('set_milestone_status', {
        p_slug: 'p1',
        p_key: 'm1',
        p_status: 'completed',
      }),
    )
    expectContract(
      mutation(projectDetailSchema),
      await h.alice.rpc('update_project_links', {
        p_slug: 'p1',
        p_patch: { deployUrl: 'https://x.dev' },
      }),
    )

    const [review] = await h.alice.rpc<Json[]>('list_reviews', { p_scope: 'all' })
    expectContract(
      mutation(reviewSchema),
      await h.alice.rpc('complete_review', { p_id: review.id }),
    )
    expectContract(mutation(reviewSchema), await h.alice.rpc('undo_review', { p_id: review.id }))

    const created = await h.alice.rpc<Json>('create_study_session', {
      p_input: { durationMinutes: 10 },
    })
    expectContract(mutation(studySessionSchema), created)
    expectContract(
      mutation(studySessionSchema),
      await h.alice.rpc('update_study_session', {
        p_id: created.data.id,
        p_input: { durationMinutes: 20 },
      }),
    )
    expectContract(
      z.object({ profile: profileSchema }),
      await h.alice.rpc('delete_study_session', { p_id: created.data.id }),
    )
  })
})
