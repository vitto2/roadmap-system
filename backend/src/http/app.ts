import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import scalar from '@scalar/fastify-api-reference'
import Fastify, { type FastifyInstance } from 'fastify'
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import { Auth } from '../auth'
import type { AppContext } from '../context'
import { AppError } from '../errors'
import { authRoutes } from './routes/auth'
import { extraRoutes } from './routes/extras'
import { profileRoutes } from './routes/profile'
import { projectRoutes } from './routes/projects'
import { reviewRoutes } from './routes/reviews'
import { sessionRoutes } from './routes/sessions'
import { topicRoutes } from './routes/topics'

export interface BuildAppOptions {
  logger?: boolean
  /** Padrão: autenticação opcional controlada por AUTH_PASSWORD. */
  auth?: Auth
}

export function buildApp(ctx: AppContext, options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false })
  const auth = options.auth ?? new Auth(ctx.config.authPassword, ctx.config.authSecret)

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  app.register(cors, {
    origin: ctx.config.corsOrigin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['Content-Disposition'],
  })

  // Documentação OpenAPI gerada a partir dos schemas Zod das rotas (em /api/docs).
  app.register(swagger, {
    openapi: {
      info: {
        title: 'Trilha Sênior API',
        description:
          'API do roadmap gamificado. O XP e os níveis são sempre calculados no servidor.',
        version: '1.0.0',
      },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
      },
    },
    transform: jsonSchemaTransform,
  })
  app.register(scalar, { routePrefix: '/api/docs' })

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

  app.get('/api/health', { schema: { hide: true } }, async () => ({ status: 'ok' }))

  app.register(
    async (api) => {
      // Se AUTH_PASSWORD estiver definido, toda rota exige "Authorization: Bearer <token>",
      // exceto as de /auth.
      api.addHook('onRequest', async (request) => {
        if (!auth.enabled || request.method === 'OPTIONS') return
        if (request.url.startsWith('/api/v1/auth/')) return
        const header = request.headers.authorization ?? ''
        const token = header.startsWith('Bearer ') ? header.slice(7) : undefined
        if (!auth.verifyToken(token, ctx.now())) {
          throw new AppError(401, 'unauthenticated', 'Autenticação necessária.')
        }
      })

      await api.register(authRoutes, { ctx, auth })
      await api.register(profileRoutes, { ctx })
      await api.register(topicRoutes, { ctx })
      await api.register(projectRoutes, { ctx })
      await api.register(reviewRoutes, { ctx })
      await api.register(sessionRoutes, { ctx })
      await api.register(extraRoutes, { ctx })
    },
    { prefix: '/api/v1' },
  )

  return app
}
