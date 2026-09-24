import {
  createSession,
  resolveSession,
  revokeSession,
  verifyPassword,
} from '@warka/auth'
import {
  findPasswordHashForUser,
  findUserByEmail,
  type PrismaClient,
  type User,
} from '@warka/database'

export type AuthService = {
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
  }
}
