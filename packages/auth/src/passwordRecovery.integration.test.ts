import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createDatabaseClient,
  createRecoveryRequest,
  createRecoveryToken,
} from '@warka/database'
import { createSession, resolveSession } from './sessions.js'
import { hashPassword, verifyPassword } from './passwords.js'
import {
  InvalidRecoveryTokenError,
  resetPasswordWithRecoveryToken,
} from './passwordRecovery.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('password recovery in PostgreSQL', () => {
  it('changes password, consumes token, revokes sessions, and audits without secrets', async () => {
    const oldPassword = 'OriginalPassword123!'
    const newPassword = 'RecoveredPassword123!'
    const user = await database!.user.create({
      data: {
        email: `password-recovery-${randomUUID()}@example.test`,
        displayName: 'Recovery User',
        passwordCredential: {
          create: { passwordHash: await hashPassword(oldPassword) },
        },
      },
    })
    try {
      const oldSession = await createSession(database!, user.id)
      const request = await createRecoveryRequest(database!, user.id)
      const token = (await createRecoveryToken(database!, request.id))!
      await expect(
        resetPasswordWithRecoveryToken(database!, 'invalid', newPassword),
      ).rejects.toBeInstanceOf(InvalidRecoveryTokenError)
      await expect(
        resetPasswordWithRecoveryToken(database!, token, 'short'),
      ).rejects.toThrow()
      await resetPasswordWithRecoveryToken(database!, token, newPassword)
      expect(await resolveSession(database!, oldSession.token)).toBeNull()
      const credential = await database!.passwordCredential.findUniqueOrThrow({
        where: { userId: user.id },
      })
      expect(await verifyPassword(newPassword, credential.passwordHash)).toBe(
        true,
      )
      expect(await verifyPassword(oldPassword, credential.passwordHash)).toBe(
        false,
      )
      await expect(
        resetPasswordWithRecoveryToken(database!, token, newPassword),
      ).rejects.toBeInstanceOf(InvalidRecoveryTokenError)
      const audit = await database!.auditEvent.findFirstOrThrow({
        where: { action: 'account.recovered', actorUserId: user.id },
      })
      expect(JSON.stringify(audit)).not.toContain(token)
      expect(JSON.stringify(audit)).not.toContain(newPassword)
    } finally {
      await database!.auditEvent.deleteMany({ where: { actorUserId: user.id } })
      await database!.user.delete({ where: { id: user.id } })
    }
  })
})
