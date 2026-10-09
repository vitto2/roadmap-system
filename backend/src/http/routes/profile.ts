import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { AppContext } from '../../context'
import { dashboardSchema, profileSchema, settingsSchema } from '../../dto'
import { buildDashboard, buildProfile } from '../../services/profile'
import { getSettings, isValidTimeZone, updateSettings } from '../../services/settings'
import { dataOf } from '../schemas'

export const profileRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = async (app, { ctx }) => {
  app.get(
    '/profile',
    {
      schema: {
        tags: ['Perfil'],
        summary: 'XP, nível, streak e progresso geral',
        response: { 200: dataOf(profileSchema) },
      },
    },
    async () => ({ data: buildProfile(ctx) }),
  )

  app.get(
    '/dashboard',
    {
      schema: {
        tags: ['Perfil'],
        summary: 'Dados do dashboard',
        response: { 200: dataOf(dashboardSchema) },
      },
    },
    async () => ({ data: buildDashboard(ctx) }),
  )

  app.get(
    '/settings',
    {
      schema: {
        tags: ['Configurações'],
        summary: 'Fuso horário e meta semanal',
        response: { 200: dataOf(settingsSchema) },
      },
    },
    async () => ({ data: getSettings(ctx) }),
  )

  app.put(
    '/settings',
    {
      schema: {
        tags: ['Configurações'],
        summary: 'Atualiza fuso horário e/ou meta semanal',
        body: z.object({
          timezone: z
            .string()
            .refine(
              isValidTimeZone,
              'Fuso horário inválido (use um nome IANA, ex.: America/Sao_Paulo).',
            )
            .optional(),
          weeklyGoal: z.number().int().min(1).max(50).optional(),
        }),
        response: { 200: dataOf(settingsSchema) },
      },
    },
    async (request) => ({ data: updateSettings(ctx, request.body) }),
  )
}
