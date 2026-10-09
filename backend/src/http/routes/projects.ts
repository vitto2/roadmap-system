import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { setMilestoneStatus, updateProjectLinks } from '../../actions/projects'
import type { AppContext } from '../../context'
import { milestoneStatusSchema, projectDetailSchema, projectSummarySchema } from '../../dto'
import { getProjectDetail, listProjects } from '../../services/projects'
import { dataOf, mutationOf, optionalUrl, slugParams, withProfile } from '../schemas'

export const projectRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  app.get(
    '/projects',
    {
      schema: {
        tags: ['Projetos'],
        summary: 'Catálogo de projetos desafio',
        response: { 200: dataOf(z.array(projectSummarySchema)) },
      },
    },
    async () => ({ data: listProjects(ctx) }),
  )

  app.get(
    '/projects/:slug',
    {
      schema: {
        tags: ['Projetos'],
        summary: 'Projeto com etapas e critérios de aceite',
        params: slugParams,
        response: { 200: dataOf(projectDetailSchema) },
      },
    },
    async (request) => ({ data: getProjectDetail(ctx, request.params.slug) }),
  )

  app.patch(
    '/projects/:slug/progress',
    {
      schema: {
        tags: ['Projetos'],
        summary: 'Atualiza os links de repositório e deploy',
        params: slugParams,
        body: z.object({
          repositoryUrl: optionalUrl.optional(),
          deployUrl: optionalUrl.optional(),
        }),
        response: { 200: mutationOf(projectDetailSchema) },
      },
    },
    async (request) => {
      updateProjectLinks(ctx, request.params.slug, request.body)
      return withProfile(ctx, getProjectDetail(ctx, request.params.slug))
    },
  )

  app.put(
    '/projects/:slug/milestones/:key',
    {
      schema: {
        tags: ['Projetos'],
        summary: 'Define o status de uma etapa',
        params: z.object({ slug: z.string().min(1), key: z.string().min(1) }),
        body: z.object({ status: milestoneStatusSchema }),
        response: { 200: mutationOf(projectDetailSchema) },
      },
    },
    async (request) => {
      const { slug, key } = request.params
      setMilestoneStatus(ctx, slug, key, request.body.status)
      return withProfile(ctx, getProjectDetail(ctx, slug))
    },
  )
}
