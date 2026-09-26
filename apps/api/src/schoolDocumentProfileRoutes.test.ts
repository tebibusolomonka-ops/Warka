import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerSchoolDocumentProfileRoutes } from './schoolDocumentProfileRoutes.js'

const mocks = vi.hoisted(() => ({
  getSchoolDocumentProfile: vi.fn(),
  saveSchoolDocumentProfile: vi.fn(),
}))
vi.mock('@warka/database', async (original) => ({
  ...(await original<typeof import('@warka/database')>()),
  ...mocks,
}))
const actorId = '08b6fcb4-07b6-4fbe-8ad7-0f6001db315c'
const schoolId = '9d113102-69c3-436b-ab9b-45f65f47ed4a'
function testApp(authenticated = true) {
  const app = Fastify()
  registerSchoolDocumentProfileRoutes(
    app,
    () => ({}) as PrismaClient,
    async (request, reply) => {
      if (!authenticated) {
        await reply.code(401).send({ error: 'Unauthenticated' })
        return
      }
      request.currentUser = { id: actorId } as User
    },
  )
  return app
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSchoolDocumentProfile.mockResolvedValue(null)
  mocks.saveSchoolDocumentProfile.mockResolvedValue({
    schoolId,
    officialName: 'Official School',
  })
})
describe('school document profile routes', () => {
  it('requires a session and passes the actor and school to controlled operations', async () => {
    const anonymous = testApp(false)
    expect(
      (
        await anonymous.inject({
          method: 'GET',
          url: `/schools/${schoolId}/document-profile`,
        })
      ).statusCode,
    ).toBe(401)
    await anonymous.close()
    const app = testApp()
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/schools/${schoolId}/document-profile`,
        })
      ).statusCode,
    ).toBe(200)
    expect(mocks.getSchoolDocumentProfile).toHaveBeenCalledWith(
      expect.anything(),
      actorId,
      schoolId,
    )
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/schools/${schoolId}/document-profile`,
          payload: { officialName: 'Official School' },
        })
      ).statusCode,
    ).toBe(200)
    expect(mocks.saveSchoolDocumentProfile).toHaveBeenCalledWith(
      expect.anything(),
      actorId,
      schoolId,
      { officialName: 'Official School' },
    )
    await app.close()
  })
})
