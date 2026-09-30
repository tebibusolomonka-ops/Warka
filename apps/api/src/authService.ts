import {
  createSession,
  InvalidRecoveryTokenError,
  resetPasswordWithRecoveryToken,
  listOwnSessions,
  revokeOwnSession,
  revokeOtherSessions,
  hashPassword,
  PasswordSchema,
  hashSessionToken,
  resolveSession,
  revokeSession,
  verifyPassword,
} from '@warka/auth'
import {
  createRecoveryRequest,
  isLoginThrottled,
  recordFailedLogin,
  clearFailedLogins,
  createRecoveryToken,
  issueDerivedRecoveryToken,
  findPasswordHashForUser,
  mustChangePassword,
  findUserByEmail,
  type PrismaClient,
  type User,
} from '@warka/database'
import type { CalendarPreference, SupportedLocale } from '@warka/shared'
import { enqueueTransactionalEmail } from './emailOutbox.js'

export type AuthService = {
  listSessions?(token: string): Promise<Array<{
    managementId: string
    createdAt: Date
    expiresAt: Date
    current: boolean
  }> | null>
  revokeSession?(token: string, managementId: string): Promise<boolean>
  revokeOthers?(token: string): Promise<boolean>
  requestRecovery?(email: string): Promise<void>
  resetRecovery?(token: string, newPassword: string): Promise<boolean>
  passwordState?(token: string): Promise<boolean>
  changePassword?(
    token: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<'changed' | 'invalid-current' | 'unauthenticated'>
  login(
    email: string,
    password: string,
  ): Promise<{ user: User; token: string } | null>
  currentUser(token: string): Promise<User | null>
  logout(token: string): Promise<void>
  setPreferredLocale?(
    token: string,
    locale: SupportedLocale,
  ): Promise<SupportedLocale | null>
  setPreferredCalendar?(
    token: string,
    calendar: CalendarPreference,
  ): Promise<CalendarPreference | null>
}

export function createAuthService(
  database: PrismaClient,
  deliverRecoveryToken?: (email: string, token: string) => Promise<void>,
  recoveryOutboxKey?: string,
): AuthService {
  return {
    async listSessions(token) {
      const user = await resolveSession(database, token)
      return user ? listOwnSessions(database, user.id, token) : null
    },
    async revokeSession(token, managementId) {
      const user = await resolveSession(database, token)
      return user ? revokeOwnSession(database, user.id, managementId) : false
    },
    async revokeOthers(token) {
      const user = await resolveSession(database, token)
      if (!user) return false
      await revokeOtherSessions(database, user.id, token)
      return true
    },
    async requestRecovery(email) {
      const user = await findUserByEmail(database, email)
      if (!user || user.accountStatus !== 'active') return
      if (!deliverRecoveryToken && !recoveryOutboxKey) return
      const request = await createRecoveryRequest(database, user.id)
      if (deliverRecoveryToken) {
        const token = await createRecoveryToken(database, request.id)
        if (token) await deliverRecoveryToken(user.email, token)
        return
      }
      const existing = await database.emailDelivery.findUnique({
        where: { recoveryRequestId: request.id },
        select: { id: true },
      })
      if (existing) return
      const token = await issueDerivedRecoveryToken(
        database,
        request.id,
        recoveryOutboxKey!,
      )
      if (!token) return
      await enqueueTransactionalEmail(database, {
        recipientUserId: user.id,
        recoveryRequestId: request.id,
        recipientAddress: user.email,
        templateKey: 'accountRecovery',
      })
    },
    async resetRecovery(token, newPassword) {
      try {
        await resetPasswordWithRecoveryToken(database, token, newPassword)
        return true
      } catch (error) {
        if (error instanceof InvalidRecoveryTokenError) return false
        throw error
      }
    },
    async login(email, password) {
      if (await isLoginThrottled(database, email)) return null
      const user = await findUserByEmail(database, email)
      const passwordHash = user
        ? await findPasswordHashForUser(database, user.id)
        : null
      if (
        !(await verifyPassword(password, passwordHash)) ||
        !user ||
        user.accountStatus !== 'active'
      ) {
        await recordFailedLogin(database, email)
        return null
      }
      await clearFailedLogins(database, email)
      const { token } = await createSession(database, user.id)
      return { user, token }
    },
    currentUser: (token) => resolveSession(database, token),
    logout: (token) => revokeSession(database, token),
    async setPreferredLocale(token, locale) {
      const user = await resolveSession(database, token)
      if (!user) return null
      await database.$executeRaw`
        UPDATE "User"
        SET "preferredLocale" = ${locale}::"PreferredLocale", "updatedAt" = NOW()
        WHERE "id" = ${user.id}
      `
      return locale
    },
    async setPreferredCalendar(token, calendar) {
      const user = await resolveSession(database, token)
      if (!user) return null
      await database.$executeRaw`
        UPDATE "User"
        SET "preferredCalendar" = ${calendar}::"CalendarPreference", "updatedAt" = NOW()
        WHERE "id" = ${user.id}
      `
      return calendar
    },
    async passwordState(token) {
      const user = await resolveSession(database, token)
      return user ? mustChangePassword(database, user.id) : false
    },
    async changePassword(token, currentPassword, newPassword) {
      const user = await resolveSession(database, token)
      if (!user) return 'unauthenticated'
      PasswordSchema.parse(newPassword)
      const currentHash = await findPasswordHashForUser(database, user.id)
      if (!(await verifyPassword(currentPassword, currentHash)))
        return 'invalid-current'
      const passwordHash = await hashPassword(newPassword)
      await database.$transaction([
        database.passwordCredential.update({
          where: { userId: user.id },
          data: { passwordHash, mustChangePassword: false },
        }),
        database.session.deleteMany({
          where: {
            userId: user.id,
            tokenHash: { not: hashSessionToken(token) },
          },
        }),
      ])
      return 'changed'
    },
  }
}
