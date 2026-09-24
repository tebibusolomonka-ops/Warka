import Fastify from 'fastify'
import { HealthResponseSchema } from '@warka/shared'

export function buildApp() {
  const app = Fastify()

  app.get('/health', async () => HealthResponseSchema.parse({ status: 'ok' }))

  return app
}
