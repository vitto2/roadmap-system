import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  completeTopic,
  masterTopic,
  reopenTopic,
  setChecklistItem,
  updateTopicProgress,
} from '../../actions/topics'
import type { AppContext } from '../../context'
import {
  careerLevelSchema,
  topicDetailSchema,
  topicStatusSchema,
  topicSummarySchema,
  trackDetailSchema,
  trackSummarySchema,
} from '../../dto'
import { getTopicDetail, getTrackDetail, listTopics, listTracks } from '../../services/topics'
import { dataOf, mutationOf, optionalUrl, slugParams, withProfile } from '../schemas'

const topicParams = slugParams
const checklistParams = z.object({ slug: z.string().min(1), key: z.string().min(1).max(120) })

export const topicRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  app.get(
    '/tracks',
    {
      schema: {
        tags: ['Trilhas'],
        summary: 'Lista as trilhas com progresso',
        response: { 200: dataOf(z.array(trackSummarySchema)) },
      },
    },
    async () => ({ data: listTracks(ctx) }),
  )

  app.get(
    '/tracks/:slug',
    {
      schema: {
        tags: ['Trilhas'],
        summary: 'Trilha com seus tópicos',
        params: slugParams,
        response: { 200: dataOf(trackDetailSchema) },
      },
    },
    async (request) => ({ data: getTrackDetail(ctx, request.params.slug) }),
  )

  app.get(
    '/topics',
    {
      schema: {
        tags: ['Tópicos'],
        summary: 'Lista tópicos (filtros: trilha, nível, status)',
        querystring: z.object({
          track: z.string().optional(),
          level: careerLevelSchema.optional(),
          status: topicStatusSchema.optional(),
        }),
        response: { 200: dataOf(z.array(topicSummarySchema)) },
      },
    },
    async (request) => ({ data: listTopics(ctx, request.query) }),
  )

  app.get(
    '/topics/:slug',
    {
      schema: {
        tags: ['Tópicos'],
        summary: 'Detalhe do tópico',
        params: topicParams,
        response: { 200: dataOf(topicDetailSchema) },
      },
    },
    async (request) => ({ data: getTopicDetail(ctx, request.params.slug) }),
  )

  app.patch(
    '/topics/:slug/progress',
    {
      schema: {
        tags: ['Tópicos'],
        summary: 'Atualiza status (não iniciado/estudando), notas e evidência',
        params: topicParams,
        body: z.object({
          status: z.enum(['not_started', 'studying']).optional(),
          notes: z.string().max(20_000).optional(),
          evidenceUrl: optionalUrl.optional(),
        }),
        response: { 200: mutationOf(topicDetailSchema) },
      },
    },
    async (request) => {
      updateTopicProgress(ctx, request.params.slug, request.body)
      return withProfile(ctx, getTopicDetail(ctx, request.params.slug))
    },
  )

  app.put(
    '/topics/:slug/checklist/:key',
    {
      schema: {
        tags: ['Tópicos'],
        summary: 'Marca/desmarca um item do checklist',
        params: checklistParams,
        body: z.object({ checked: z.boolean() }),
        response: { 200: mutationOf(topicDetailSchema) },
      },
    },
    async (request) => {
      const { slug, key } = request.params
      setChecklistItem(ctx, slug, key, request.body.checked)
      return withProfile(ctx, getTopicDetail(ctx, slug))
    },
  )

  const actions = [
    ['complete', completeTopic, 'Conclui o tópico (exige o checklist completo)'],
    [
      'master',
      masterTopic,
      'Já domino: marca o checklist inteiro e conclui (só revisão de 90 dias)',
    ],
    ['reopen', reopenTopic, 'Reabre um tópico concluído (desfaz o XP)'],
  ] as const

  for (const [name, action, summary] of actions) {
    app.post(
      `/topics/:slug/${name}`,
      {
        schema: {
          tags: ['Tópicos'],
          summary,
          params: topicParams,
          response: { 200: mutationOf(topicDetailSchema) },
        },
      },
      async (request) => {
        action(ctx, request.params.slug)
        return withProfile(ctx, getTopicDetail(ctx, request.params.slug))
      },
    )
  }
}
