import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { ImportPermissionError, ImportStateError } from '@warka/database'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ImportPayloadError, registerImportRoutes } from './importRoutes.js'

const mocks = vi.hoisted(() => ({
  createImportJob: vi.fn(),
  validateStudentImport: vi.fn(),
  getImportJob: vi.fn(),
  listSchoolImportJobs: vi.fn(),
  applyStudentImport: vi.fn(),
  cancelImportJob: vi.fn(),
}))

vi.mock('@warka/database', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@warka/database')>()),
  ...mocks,
}))

const actorId = '08b6fcb4-07b6-4fbe-8ad7-0f6001db315c'
const schoolId = '9d113102-69c3-436b-ab9b-45f65f47ed4a'
const otherSchoolId = '170e608a-d03c-41af-93cf-7db56875598b'
const jobId = '2efecf04-56d3-4b91-928f-f696118859c2'
const job = {
  id: jobId,
  schoolId,
  status: 'validated',
  totalRows: 1,
  validRows: 1,
  invalidRows: 0,
  normalizedRows: [{ givenName: 'Private student name' }],
  issues: [],
}

function testApp(authenticated = true) {
  const app = Fastify()
  registerImportRoutes(
    app,
    () => ({}) as PrismaClient,
    async (request, reply) => {
      if (!authenticated) {
        await reply.code(401).send({ error: { code: 'UNAUTHENTICATED' } })
        return
      }
      request.currentUser = { id: actorId } as User
    },
  )
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ImportPermissionError)
      return reply.code(403).send({ error: error.message })
    if (error instanceof ImportStateError)
      return reply.code(409).send({ error: error.message })
    if (error instanceof ImportPayloadError)
      return reply.code(413).send({ error: error.message })
    return reply.code(400).send({ error: error.message })
  })
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createImportJob.mockResolvedValue(job)
  mocks.validateStudentImport.mockResolvedValue(job)
  mocks.getImportJob.mockResolvedValue(job)
  mocks.listSchoolImportJobs.mockResolvedValue([job])
  mocks.applyStudentImport.mockResolvedValue({
    job: { ...job, status: 'applied' },
    created: [{ studentId: 'student-id', studentReference: 'WKA-1' }],
  })
  mocks.cancelImportJob.mockResolvedValue({ ...job, status: 'cancelled' })
})

describe('school student import routes', () => {
  it('requires authentication and passes actor and school scope to upload', async () => {
    const anonymous = testApp(false)
    expect(
      (
        await anonymous.inject({
          method: 'POST',
          url: `/schools/${schoolId}/imports`,
          payload: { csv: 'givenName\nAda' },
        })
      ).statusCode,
    ).toBe(401)
    await anonymous.close()

    const app = testApp()
    const response = await app.inject({
      method: 'POST',
      url: `/schools/${schoolId}/imports`,
      payload: { csv: 'givenName\nAda', originalFileName: 'students.csv' },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).not.toHaveProperty('normalizedRows')
    expect(mocks.createImportJob).toHaveBeenCalledWith(
      expect.anything(),
      actorId,
      { schoolId, originalFileName: 'students.csv' },
    )
    expect(mocks.validateStudentImport).toHaveBeenCalledWith(
      expect.anything(),
      actorId,
      schoolId,
      jobId,
      'givenName\nAda',
    )
    await app.close()
  })

  it('denies unauthorized roles and cross-school job inspection', async () => {
    const app = testApp()
    mocks.createImportJob.mockRejectedValueOnce(new ImportPermissionError())
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/schools/${schoolId}/imports`,
          payload: { csv: 'givenName\nAda' },
        })
      ).statusCode,
    ).toBe(403)
    mocks.getImportJob.mockRejectedValueOnce(new ImportPermissionError())
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/schools/${otherSchoolId}/imports/${jobId}`,
        })
      ).statusCode,
    ).toBe(403)
    await app.close()
  })

  it('rejects non-CSV names and oversized payloads', async () => {
    const app = testApp()
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/schools/${schoolId}/imports`,
          payload: { csv: 'not csv', originalFileName: 'students.xlsx' },
        })
      ).statusCode,
    ).toBe(413)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/schools/${schoolId}/imports`,
          payload: { csv: 'a'.repeat(1_000_001) },
        })
      ).statusCode,
    ).toBe(413)
    expect(mocks.createImportJob).not.toHaveBeenCalled()
    await app.close()
  })

  it('returns structured validation warnings and errors without stored rows', async () => {
    const app = testApp()
    mocks.validateStudentImport
      .mockResolvedValueOnce({
        ...job,
        status: 'invalid',
        issues: [{ rowNumber: 2, severity: 'error', code: 'invalidClass' }],
      })
      .mockResolvedValueOnce({
        ...job,
        issues: [
          { rowNumber: 2, severity: 'warning', code: 'possibleDuplicate' },
        ],
      })
    const invalid = await app.inject({
      method: 'POST',
      url: `/schools/${schoolId}/imports/${jobId}/validate`,
      payload: { csv: 'givenName\nAda' },
    })
    expect(invalid.json()).toMatchObject({
      status: 'invalid',
      issues: [{ code: 'invalidClass' }],
    })
    expect(invalid.json()).not.toHaveProperty('normalizedRows')
    const warning = await app.inject({
      method: 'POST',
      url: `/schools/${schoolId}/imports/${jobId}/validate`,
      payload: { csv: 'givenName\nAda' },
    })
    expect(warning.json()).toMatchObject({
      issues: [{ severity: 'warning', code: 'possibleDuplicate' }],
    })
    await app.close()
  })

  it('applies once with explicit acknowledgement, lists scoped jobs, and cancels', async () => {
    const app = testApp()
    const applied = await app.inject({
      method: 'POST',
      url: `/schools/${schoolId}/imports/${jobId}/apply`,
      payload: { acknowledgeWarnings: true },
    })
    expect(applied.statusCode).toBe(200)
    expect(applied.json().job).not.toHaveProperty('normalizedRows')
    expect(mocks.applyStudentImport).toHaveBeenCalledWith(
      expect.anything(),
      actorId,
      schoolId,
      jobId,
      true,
    )
    mocks.applyStudentImport.mockRejectedValueOnce(new ImportStateError())
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/schools/${schoolId}/imports/${jobId}/apply`,
          payload: { acknowledgeWarnings: true },
        })
      ).statusCode,
    ).toBe(409)
    const list = await app.inject({
      method: 'GET',
      url: `/schools/${schoolId}/imports`,
    })
    expect(list.json()[0]).not.toHaveProperty('normalizedRows')
    expect(mocks.listSchoolImportJobs).toHaveBeenCalledWith(
      expect.anything(),
      actorId,
      schoolId,
    )
    const cancelled = await app.inject({
      method: 'POST',
      url: `/schools/${schoolId}/imports/${jobId}/cancel`,
    })
    expect(cancelled.json().status).toBe('cancelled')
    await app.close()
  })
})
