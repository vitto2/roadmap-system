import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { createSession, deleteSession, updateSession } from '../../actions/sessions'
import type { AppContext } from '../../context'
import { profileSchema, studySessionSchema } from '../../dto'
import { getSession, listSessions } from '../../services/sessions'
import { buildProfile } from '../../services/profile'
import { idParams, isoDate, mutationOf, withProfile } from '../schemas'

const sessionBody = z.object({
  studiedOn: isoDate.optional(),
  durationMinutes: z.number().int().min(1).max(1440),
  topicSlug: z.string().min(1).nullable().optional(),
  note: z.string().max(500).optional(),
})

export const sessionRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  app.get(
    '/study-sessions',
    {
      schema: {
        tags: ['Diário'],
        summary: 'Diário de estudo (paginado, mais recentes primeiro)',
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          perPage: z.coerce.number().int().min(1).max(100).default(20),
        }),
        response: {
          200: z.object({
            data: z.array(studySessionSchema),
            meta: z.object({ page: z.number(), perPage: z.number(), total: z.number() }),
          }),
        },
      },
    },
    async (request) => listSessions(ctx, request.query),
  )

  app.post(
    '/study-sessions',
    {
      schema: {
        tags: ['Diário'],
        summary: 'Registra uma sessão de estudo',
        body: sessionBody,
        response: { 201: mutationOf(studySessionSchema) },
      },
    },
    async (request, reply) => {
      const id = createSession(ctx, request.body)
      return reply.status(201).send(withProfile(ctx, getSession(ctx, id)))
    },
  )

  app.put(
    '/study-sessions/:id',
    {
      schema: {
        tags: ['Diário'],
        summary: 'Edita uma sessão',
        params: idParams,
        body: sessionBody,
        response: { 200: mutationOf(studySessionSchema) },
      },
    },
    async (request) => {
      updateSession(ctx, request.params.id, request.body)
      return withProfile(ctx, getSession(ctx, request.params.id))
    },
  )

  app.delete(
    '/study-sessions/:id',
    {
      schema: {
        tags: ['Diário'],
        summary: 'Remove uma sessão',
        params: idParams,
        response: { 200: z.object({ profile: profileSchema }) },
      },
    },
    async (request) => {
      deleteSession(ctx, request.params.id)
      return { profile: buildProfile(ctx) }
    },
  )
}
