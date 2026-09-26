import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { createSchoolExport, serializeCsv } from './schoolExports.js'

const actorId = '08b6fcb4-07b6-4fbe-8ad7-0f6001db315c'
const schoolId = '9d113102-69c3-436b-ab9b-45f65f47ed4a'
const otherSchoolId = '170e608a-d03c-41af-93cf-7db56875598b'

function fakeDatabase() {
  const database = {
    school: {
      findUnique: vi.fn().mockResolvedValue({ organizationId: otherSchoolId }),
    },
    organizationMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    schoolMembership: {
      findUnique: vi.fn().mockResolvedValue({ role: 'administrator' }),
    },
    enrollment: { findMany: vi.fn().mockResolvedValue([]) },
    publishedResult: { findMany: vi.fn().mockResolvedValue([]) },
    auditEvent: { create: vi.fn().mockResolvedValue({}) },
  }
  return database
}

describe('school exports', () => {
  it('quotes CSV safely, including formula prefixes, commas, quotes, and newlines', () => {
    expect(
      serializeCsv([
        ['name', 'score'],
        ['=1+1', 5],
        [' +SUM(1)', 2],
        ['"A,B"\nC', 1],
      ]),
    ).toBe(
      '"name","score"\r\n"\'=1+1","5"\r\n"\' +SUM(1)","2"\r\n"""A,B""\nC","1"\r\n',
    )
  })

  it('rejects student, guardian, and bureau-only users', async () => {
    const database = fakeDatabase()
    database.schoolMembership.findUnique.mockResolvedValue(null)
    for (const type of [
      'studentRoster',
      'approvedEnrollmentRoster',
      'publishedResults',
    ] as const)
      await expect(
        createSchoolExport(
          database as unknown as PrismaClient,
          actorId,
          schoolId,
          type,
        ),
      ).rejects.toThrow('Import permission denied')
    expect(database.enrollment.findMany).not.toHaveBeenCalled()
    expect(database.auditEvent.create).not.toHaveBeenCalled()
  })

  it('scopes approved roster and published results and audits each completed export', async () => {
    const database = fakeDatabase()
    await createSchoolExport(
      database as unknown as PrismaClient,
      actorId,
      schoolId,
      'approvedEnrollmentRoster',
    )
    expect(database.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId, status: 'approved' } }),
    )
    await createSchoolExport(
      database as unknown as PrismaClient,
      actorId,
      schoolId,
      'publishedResults',
    )
    expect(database.publishedResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId, resultSet: { status: 'published' } },
      }),
    )
    expect(database.auditEvent.create).toHaveBeenCalledTimes(2)
    expect(database.auditEvent.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        schoolId,
        actorUserId: actorId,
        action: 'schoolData.exported',
        metadata: { exportType: 'publishedResults', rowCount: 0 },
      }),
    })
  })

  it('includes only approved or draft students from the target school in roster', async () => {
    const database = fakeDatabase()
    await createSchoolExport(
      database as unknown as PrismaClient,
      actorId,
      schoolId,
      'studentRoster',
    )
    expect(database.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId, status: { in: ['draft', 'approved'] } },
      }),
    )
  })
})
