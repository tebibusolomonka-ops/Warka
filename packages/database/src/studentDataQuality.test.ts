import type { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { checkStudentDataQuality } from './studentDataQuality.js'

const schoolId = '11111111-1111-4111-8111-111111111111'
describe('student data quality checks', () => {
  it('returns stable factual findings without changing students or treating optional identification as required', async () => {
    const database = {
      student: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'a',
            studentReference: '',
            givenName: 'Hana',
            enrollments: [{ schoolId }],
          },
          {
            id: 'b',
            studentReference: 'WKA-2',
            givenName: '',
            enrollments: [{ schoolId }],
          },
          {
            id: 'c',
            studentReference: 'WKA-2',
            givenName: 'Other',
            enrollments: [{ schoolId }],
          },
        ]),
      },
    } as unknown as PrismaClient
    const findings = await checkStudentDataQuality(database, schoolId)
    expect(findings.map((finding) => finding.code)).toEqual([
      'STUDENT_REFERENCE_MISSING',
      'STUDENT_GIVEN_NAME_MISSING',
      'STUDENT_REFERENCE_CONFLICT',
    ])
    expect(database.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { enrollments: { some: { schoolId } } },
      }),
    )
    expect(Object.keys(database.student)).toEqual(['findMany'])
    expect(
      findings.some((finding) => /national|fayda|dropout/i.test(finding.code)),
    ).toBe(false)
  })
})
