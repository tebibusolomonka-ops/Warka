import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { PasswordSchema, SESSION_LIFETIME_SECONDS } from '@warka/auth'
import {
  ErrorResponseSchema,
  CalendarPreferenceSchema,
  LanguagePreferenceResponseSchema,
  LanguagePreferenceSchema,
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
  const recoveryAttempts = new Map<string, { count: number; until: number }>()
  function limited(key: string, now = Date.now()) {
    const current = recoveryAttempts.get(key)
    if (!current || current.until <= now) {
      recoveryAttempts.set(key, { count: 1, until: now + 15 * 60_000 })
      return false
    }
    current.count += 1
    return current.count > 10
  }
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: production,
  }

  app.get('/auth/sessions', async (request, reply) => {
    const token = request.cookies[sessionCookieName]
    if (!token) return reply.code(401).send(unauthorized())
    const sessions = await getAuth().listSessions?.(token)
    if (!sessions) return reply.code(401).send(unauthorized())
    return { sessions }
  })

  app.delete('/auth/sessions/others', async (request, reply) => {
    const token = request.cookies[sessionCookieName]
    if (!token || !(await getAuth().revokeOthers?.(token)))
      return reply.code(401).send(unauthorized())
    return reply.code(204).send()
  })

  app.delete('/auth/sessions/:managementId', async (request, reply) => {
    const token = request.cookies[sessionCookieName]
    if (!token || !(await getAuth().currentUser(token)))
      return reply.code(401).send(unauthorized())
    const { managementId } = z
      .strictObject({ managementId: z.uuid() })
      .parse(request.params)
    if (!(await getAuth().revokeSession?.(token, managementId)))
      return reply.code(404).send({
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
      })
    return reply.code(204).send()
  })

  app.post('/auth/recovery/request', async (request, reply) => {
    const startedAt = Date.now()
    const { email } = z.strictObject({ email: z.email() }).parse(request.body)
    if (limited(`request:${request.ip}`))
      return reply
        .code(429)
        .send({ error: { code: 'RATE_LIMITED', message: 'Try again later' } })
    await getAuth().requestRecovery?.(email)
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, 150 - (Date.now() - startedAt))),
    )
    return reply.code(202).send({
      message: 'If the account exists, recovery instructions will be sent.',
    })
  })

  app.post('/auth/recovery/reset', async (request, reply) => {
    const { recoveryToken, newPassword } = z
      .strictObject({
        recoveryToken: z.string(),
        newPassword: PasswordSchema,
      })
      .parse(request.body)
    if (limited(`reset:${request.ip}`))
      return reply
        .code(429)
        .send({ error: { code: 'RATE_LIMITED', message: 'Try again later' } })
    const ok = await getAuth().resetRecovery?.(recoveryToken, newPassword)
    if (!ok)
      return reply.code(400).send({
        error: {
          code: 'INVALID_RECOVERY_TOKEN',
          message: 'Invalid or expired recovery token',
        },
      })
    reply.clearCookie(sessionCookieName, cookieOptions)
    return reply.code(204).send()
  })

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

  app.get('/me/language-preference', async (request, reply) => {
    const token = request.cookies[sessionCookieName]
    const user = token ? await getAuth().currentUser(token) : null
    if (!user) return reply.code(401).send(unauthorized())
    return LanguagePreferenceResponseSchema.parse({
      preferredLocale:
        (user as typeof user & { preferredLocale?: string }).preferredLocale ??
        'en',
    })
  })

  app.put('/me/language-preference', async (request, reply) => {
    const token = request.cookies[sessionCookieName]
    if (!token || !(await getAuth().currentUser(token)))
      return reply.code(401).send(unauthorized())
    const body = z
      .strictObject({ preferredLocale: LanguagePreferenceSchema })
      .parse(request.body)
    const preferredLocale = await getAuth().setPreferredLocale?.(
      token,
      body.preferredLocale,
    )
    if (!preferredLocale) return reply.code(401).send(unauthorized())
    return LanguagePreferenceResponseSchema.parse({ preferredLocale })
  })

  app.get('/me/calendar-preference', async (request, reply) => {
    const token = request.cookies[sessionCookieName]
    const user = token ? await getAuth().currentUser(token) : null
    if (!user) return reply.code(401).send(unauthorized())
    return {
      preferredCalendar:
        (user as typeof user & { preferredCalendar?: string })
          .preferredCalendar ?? 'gregorian',
    }
  })

  app.put('/me/calendar-preference', async (request, reply) => {
    const token = request.cookies[sessionCookieName]
    if (!token || !(await getAuth().currentUser(token)))
      return reply.code(401).send(unauthorized())
    const { preferredCalendar } = z
      .strictObject({ preferredCalendar: CalendarPreferenceSchema })
      .parse(request.body)
    const saved = await getAuth().setPreferredCalendar?.(
      token,
      preferredCalendar,
    )
    if (!saved) return reply.code(401).send(unauthorized())
    return { preferredCalendar: saved }
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
