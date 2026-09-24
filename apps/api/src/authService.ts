import {
  createSession,
  hashPassword,
  PasswordSchema,
  hashSessionToken,
  resolveSession,
  revokeSession,
  verifyPassword,
} from '@warka/auth'
import {
  findPasswordHashForUser,
  mustChangePassword,
  findUserByEmail,
  type PrismaClient,
  type User,
} from '@warka/database'

export type AuthService = {
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
}

export function createAuthService(database: PrismaClient): AuthService {
  return {
    async login(email, password) {
      const user = await findUserByEmail(database, email)
      const passwordHash = user
        ? await findPasswordHashForUser(database, user.id)
        : null
      if (!(await verifyPassword(password, passwordHash)) || !user) {
        return null
      }
      const { token } = await createSession(database, user.id)
      return { user, token }
    },
    currentUser: (token) => resolveSession(database, token),
    logout: (token) => revokeSession(database, token),
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
