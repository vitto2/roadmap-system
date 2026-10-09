import cors from '@fastify/cors'
import Fastify, { type FastifyInstance } from 'fastify'
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import type { AppContext } from '../context'
import { AppError } from '../errors'
import { profileRoutes } from './routes/profile'
import { projectRoutes } from './routes/projects'
import { reviewRoutes } from './routes/reviews'
import { sessionRoutes } from './routes/sessions'
import { topicRoutes } from './routes/topics'

export interface BuildAppOptions {
  logger?: boolean
}

export function buildApp(ctx: AppContext, options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false })

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  app.register(cors, {
    origin: ctx.config.corsOrigin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  // Respostas de erro padronizadas: { message, code, errors? }
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.status)
        .send({ message: error.message, code: error.code, errors: error.errors })
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      const errors: Record<string, string[]> = {}
      for (const issue of error.validation) {
        const field = issue.instancePath.replace(/^\//, '').replaceAll('/', '.') || 'request'
        ;(errors[field] ??= []).push(issue.message ?? 'Valor inválido.')
      }
      return reply
        .status(422)
        .send({ message: 'Os dados enviados são inválidos.', code: 'validation_failed', errors })
    }

    if (isResponseSerializationError(error)) {
      request.log.error({ err: error }, 'Falha ao serializar a resposta')
      return reply.status(500).send({ message: 'Erro interno do servidor.', code: 'server_error' })
    }

    const statusCode = (error as { statusCode?: number }).statusCode
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({ message: 'Requisição inválida.', code: 'bad_request' })
    }

    request.log.error({ err: error }, 'Erro não tratado')
    return reply.status(500).send({ message: 'Erro interno do servidor.', code: 'server_error' })
  })

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ message: 'Rota não encontrada.', code: 'not_found' }),
  )

  app.get('/api/health', async () => ({ status: 'ok' }))

  app.register(
    async (api) => {
      await api.register(profileRoutes, { ctx })
      await api.register(topicRoutes, { ctx })
      await api.register(projectRoutes, { ctx })
      await api.register(reviewRoutes, { ctx })
      await api.register(sessionRoutes, { ctx })
    },
    { prefix: '/api/v1' },
  )

  return app
}
