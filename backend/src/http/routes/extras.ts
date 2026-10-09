import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { AppContext } from '../../context'
import { graphSchema, profileSchema } from '../../dto'
import { buildGraph } from '../../services/graph'
import { backupSchema, exportBackup, importBackup } from '../../services/backup'
import { renderPortfolio } from '../../services/portfolio'
import { buildProfile } from '../../services/profile'
import { localDate } from '../../domain/scoring'
import { getSettings } from '../../services/settings'
import { dataOf } from '../schemas'

export const extraRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  app.get(
    '/graph',
    {
      schema: {
        tags: ['Grafo'],
        summary: 'Grafo de pré-requisitos (tópicos bloqueados e desbloqueados)',
        response: { 200: dataOf(graphSchema) },
      },
    },
    async () => ({ data: buildGraph(ctx) }),
  )

  app.get(
    '/export/portfolio.md',
    {
      schema: {
        tags: ['Exportação'],
        summary: 'Portfólio de projetos concluídos em markdown',
      },
    },
    async (_request, reply) =>
      reply
        .type('text/markdown; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="portfolio.md"')
        .send(renderPortfolio(ctx)),
  )

  app.get(
    '/export/backup',
    { schema: { tags: ['Exportação'], summary: 'Backup do progresso em JSON' } },
    async (_request, reply) => {
      const day = localDate(ctx.now(), getSettings(ctx).timezone)
      return reply
        .type('application/json; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="trilha-senior-backup-${day}.json"`)
        .send(exportBackup(ctx))
    },
  )

  app.post(
    '/import/backup',
    {
      bodyLimit: 20 * 1024 * 1024,
      schema: {
        tags: ['Exportação'],
        summary: 'Restaura o progresso a partir de um backup (substitui o progresso atual)',
        body: backupSchema,
        response: {
          200: z.object({
            data: z.object({
              imported: z.object({
                topics: z.number(),
                checklistItems: z.number(),
                reviews: z.number(),
                projects: z.number(),
                milestones: z.number(),
                sessions: z.number(),
              }),
              skipped: z.array(z.string()),
            }),
            profile: profileSchema,
          }),
        },
      },
    },
    async (request) => {
      const data = importBackup(ctx, request.body)
      return { data, profile: buildProfile(ctx) }
    },
  )
}
