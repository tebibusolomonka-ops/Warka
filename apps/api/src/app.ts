import Fastify from 'fastify'
import { createDatabaseClient, type PrismaClient } from '@warka/database'
import { ErrorResponseSchema, HealthResponseSchema } from '@warka/shared'
import { ZodError } from 'zod'
import {
  RecordNotFound,
  prismaSchoolStore,
  type SchoolStore,
} from './schoolService.js'
import { registerSchoolRoutes } from './schoolRoutes.js'

export function buildApp(options: { store?: SchoolStore } = {}) {
  const app = Fastify()
  let database: PrismaClient | undefined

  const getStore = () => {
    if (options.store) return options.store
    database ??= createDatabaseClient()
    return prismaSchoolStore(database)
  }

  app.get('/health', async () => HealthResponseSchema.parse({ status: 'ok' }))
  registerSchoolRoutes(app, getStore)

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send(
        ErrorResponseSchema.parse({
          error: { code: 'INVALID_REQUEST', message: 'Invalid request data' },
        }),
      )
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 400
    ) {
      return reply.code(400).send(
        ErrorResponseSchema.parse({
          error: { code: 'INVALID_REQUEST', message: 'Invalid request data' },
        }),
      )
    }
    if (error instanceof RecordNotFound) {
      return reply.code(404).send(
        ErrorResponseSchema.parse({
          error: { code: error.code, message: error.message },
        }),
      )
    }
    app.log.error(error)
    return reply.code(500).send(
      ErrorResponseSchema.parse({
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      }),
    )
  })

  app.addHook('onClose', async () => {
    await database?.$disconnect()
  })

  return app
}
