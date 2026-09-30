import { timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { ErrorResponseSchema } from '@warka/shared'
import type { AuthService } from './authService.js'
import { csrfTokenForSession, sessionCookieName } from './sessionSecurity.js'
import { trustedOrigins } from './originPolicy.js'

export { csrfTokenForSession } from './sessionSecurity.js'

function matches(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function rejected() {
  return ErrorResponseSchema.parse({
    error: {
      code: 'CSRF_REJECTED',
      message: 'Request origin verification failed',
    },
  })
}

export function registerCsrfProtection(
  app: FastifyInstance,
  getAuth: () => AuthService,
  env: NodeJS.ProcessEnv = process.env,
) {
  const allowed = trustedOrigins(env)
  app.get('/auth/csrf', async (request, reply) => {
    const session = request.cookies[sessionCookieName]
    if (!session || !(await getAuth().currentUser(session)))
      return reply.code(401).send(rejected())
    return { token: csrfTokenForSession(session) }
  })
  app.addHook('preHandler', async (request, reply) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return
    const origin = request.headers.origin
    if (origin) {
      let sameOrigin = false
      try {
        const parsed = new URL(origin)
        sameOrigin =
          parsed.origin === `${request.protocol}://${request.headers.host}`
      } catch {}
      if (!sameOrigin && !allowed.has(origin))
        return reply.code(403).send(rejected())
    }
    const session = request.cookies[sessionCookieName]
    if (!session || (!origin && !request.headers['sec-fetch-site'])) return
    const provided = request.headers['x-csrf-token']
    if (
      typeof provided !== 'string' ||
      !matches(provided, csrfTokenForSession(session))
    )
      return reply.code(403).send(rejected())
  })
}
