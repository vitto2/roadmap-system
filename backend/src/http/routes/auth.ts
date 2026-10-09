import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { Auth } from '../../auth'
import type { AppContext } from '../../context'
import { AppError } from '../../errors'

export const authRoutes: FastifyPluginAsyncZod<{ ctx: AppContext; auth: Auth }> = async (
  app,
  { ctx, auth },
) => {
  app.get(
    '/auth/status',
    {
      schema: {
        tags: ['Autenticação'],
        summary: 'Informa se a API exige login (AUTH_PASSWORD definido)',
        response: { 200: z.object({ required: z.boolean() }) },
      },
    },
    async () => ({ required: auth.enabled }),
  )

  app.post(
    '/auth/login',
    {
      schema: {
        tags: ['Autenticação'],
        summary: 'Troca a senha por um token (Bearer) válido por 30 dias',
        body: z.object({ password: z.string().min(1).max(200) }),
        response: { 200: z.object({ token: z.string(), expiresAt: z.string() }) },
      },
    },
    async (request) => {
      const now = ctx.now()
      const origin = request.ip
      if (auth.isThrottled(origin, now)) {
        throw new AppError(429, 'too_many_attempts', 'Muitas tentativas. Aguarde um minuto.')
      }
      if (!auth.checkPassword(request.body.password)) {
        auth.recordFailure(origin, now)
        throw new AppError(401, 'invalid_credentials', 'Senha incorreta.')
      }
      auth.clearFailures(origin)
      return auth.issueToken(now)
    },
  )
}
