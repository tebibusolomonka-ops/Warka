import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import { registerSchoolExportRoutes } from './schoolExportRoutes.js'

const mocks = vi.hoisted(() => ({ createSchoolExport: vi.fn() }))
vi.mock('@warka/database', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@warka/database')>()),
  ...mocks,
}))
const actorId = '08b6fcb4-07b6-4fbe-8ad7-0f6001db315c'
const schoolId = '9d113102-69c3-436b-ab9b-45f65f47ed4a'

function testApp(authenticated: boolean) {
  const app = Fastify()
  registerSchoolExportRoutes(
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
  app.setErrorHandler((error, _request, reply) =>
    reply
      .code(error instanceof ZodError ? 400 : 500)
      .send({ error: error.message }),
  )
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createSchoolExport.mockResolvedValue({ csv: '"name"\r\n', rowCount: 0 })
})

describe('school export route', () => {
  it('requires a session and binds the school and actor to an explicit export type', async () => {
    const anonymous = testApp(false)
    expect(
      (
        await anonymous.inject({
          method: 'GET',
          url: `/schools/${schoolId}/exports/studentRoster`,
        })
      ).statusCode,
    ).toBe(401)
    await anonymous.close()
    const app = testApp(true)
    const result = await app.inject({
      method: 'GET',
      url: `/schools/${schoolId}/exports/studentRoster`,
    })
    expect(result.statusCode).toBe(200)
    expect(result.headers['content-type']).toContain('text/csv')
    expect(result.headers['content-disposition']).toBe(
      'attachment; filename="studentRoster.csv"',
    )
    expect(result.headers['cache-control']).toBe('no-store')
    expect(mocks.createSchoolExport).toHaveBeenCalledWith(
      expect.anything(),
      actorId,
      schoolId,
      'studentRoster',
    )
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/schools/${schoolId}/exports/passwords`,
        })
      ).statusCode,
    ).toBe(400)
    await app.close()
  })
})
