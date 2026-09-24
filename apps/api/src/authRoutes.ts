import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { PasswordSchema, SESSION_LIFETIME_SECONDS } from '@warka/auth'
import {
  ErrorResponseSchema,
  LoginCredentialsSchema,
  UserIdentitySchema,
} from '@warka/shared'
import type { AuthService } from './authService.js'

export const sessionCookieName = 'warka_session'

function unauthorized() {
  return ErrorResponseSchema.parse({
    error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
  })
}

function userIdentity(user: {
  id: string
  email: string
  displayName: string
}) {
  return UserIdentitySchema.parse(user)
}

export function registerAuthRoutes(
  app: FastifyInstance,
  getAuth: () => AuthService,
  production: boolean,
) {
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: production,
  }

  app.post('/auth/login', async (request, reply) => {
    const { email, password } = LoginCredentialsSchema.parse(request.body)
    const result = await getAuth().login(email, password)
    if (!result) {
      return reply.code(401).send(
        ErrorResponseSchema.parse({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        }),
      )
    }

    reply.setCookie(sessionCookieName, result.token, {
      ...cookieOptions,
      maxAge: SESSION_LIFETIME_SECONDS,
    })
    return userIdentity(result.user)
  })

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[sessionCookieName]
    if (token) {
      await getAuth().logout(token)
    }
    reply.clearCookie(sessionCookieName, cookieOptions)
    return reply.code(204).send()
  })

  app.get('/auth/me', async (request, reply) => {
    const token = request.cookies[sessionCookieName]
    const user = token ? await getAuth().currentUser(token) : null
    if (!user) {
      reply.clearCookie(sessionCookieName, cookieOptions)
      return reply.code(401).send(unauthorized())
    }
    return UserIdentitySchema.parse({
      ...userIdentity(user),
      mustChangePassword: (await getAuth().passwordState?.(token!)) ?? false,
    })
  })

  app.post('/auth/change-password', async (request, reply) => {
    const token = request.cookies[sessionCookieName]
    if (!token || !(await getAuth().currentUser(token)))
      return reply.code(401).send(unauthorized())
    const body = z
      .strictObject({
        currentPassword: z.string(),
        newPassword: PasswordSchema,
      })
      .parse(request.body)
    const result = await getAuth().changePassword?.(
      token,
      body.currentPassword,
      body.newPassword,
    )
    if (result === 'unauthenticated')
      return reply.code(401).send(unauthorized())
    if (result === 'invalid-current')
      return reply.code(403).send(
        ErrorResponseSchema.parse({
          error: {
            code: 'INVALID_CURRENT_PASSWORD',
            message: 'Current password is incorrect',
          },
        }),
      )
    return reply.code(204).send()
  })
}
