import type { preHandlerHookHandler, FastifyRequest } from 'fastify'
import type { User } from '@warka/database'
import { ErrorResponseSchema } from '@warka/shared'
import type { AuthService } from './authService.js'
import { sessionCookieName } from './authRoutes.js'

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: User | null
  }
}

export function authenticateRequest(
  getAuth: () => AuthService,
): preHandlerHookHandler {
  return async (request, reply) => {
    const token = request.cookies[sessionCookieName]
    const user = token ? await getAuth().currentUser(token) : null
    if (!user) {
      return reply.code(401).send(
        ErrorResponseSchema.parse({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
          },
        }),
      )
    }
    request.currentUser = user
  }
}

export function authenticatedUser(request: FastifyRequest): User {
  if (!request.currentUser) {
    throw new Error('Authenticated user missing from request')
  }
  return request.currentUser
}
