import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { completeReview, undoReview } from '../../actions/reviews'
import type { AppContext } from '../../context'
import { reviewSchema } from '../../dto'
import { notFound } from '../../errors'
import { listReviews } from '../../services/topics'
import { dataOf, idParams, mutationOf, withProfile } from '../schemas'

function findReview(ctx: AppContext, id: number) {
  const review = listReviews(ctx, 'all').find((r) => r.id === id)
  if (!review) throw notFound('Revisão')
  return review
}

export const reviewRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  app.get(
    '/reviews',
    {
      schema: {
        tags: ['Revisões'],
        summary: 'Fila de revisões (padrão: as de hoje e atrasadas)',
        querystring: z.object({
          scope: z.enum(['today', 'upcoming', 'pending', 'completed', 'all']).default('today'),
        }),
        response: { 200: dataOf(z.array(reviewSchema)) },
      },
    },
    async (request) => ({ data: listReviews(ctx, request.query.scope) }),
  )

  app.post(
    '/reviews/:id/complete',
    {
      schema: {
        tags: ['Revisões'],
        summary: 'Conclui uma revisão',
        params: idParams,
        response: { 200: mutationOf(reviewSchema) },
      },
    },
    async (request) => {
      completeReview(ctx, request.params.id)
      return withProfile(ctx, findReview(ctx, request.params.id))
    },
  )

  app.post(
    '/reviews/:id/undo',
    {
      schema: {
        tags: ['Revisões'],
        summary: 'Desfaz a conclusão de uma revisão',
        params: idParams,
        response: { 200: mutationOf(reviewSchema) },
      },
    },
    async (request) => {
      undoReview(ctx, request.params.id)
      return withProfile(ctx, findReview(ctx, request.params.id))
    },
  )
}
