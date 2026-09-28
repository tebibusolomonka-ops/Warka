import { Prisma, type PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { checkAcademicDataQuality } from './academicDataQuality.js'

const schoolId = '11111111-1111-4111-8111-111111111111'
describe('academic data quality', () => {
  it('reports impossible marks and publication history without creating zeros or changing records', async () => {
    const database = {
      assessment: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              id: 'assessment',
              maximumScore: new Prisma.Decimal(10),
              weight: new Prisma.Decimal(1),
              academicYearId: 'year',
              schoolClass: { academicYearId: 'year' },
            },
          ]),
      },
      mark: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              id: 'mark',
              score: new Prisma.Decimal(12),
              assessment: {
                schoolId,
                academicYearId: 'year',
                schoolClassId: 'class',
                maximumScore: new Prisma.Decimal(10),
              },
              enrollment: {
                schoolId,
                academicYearId: 'year',
                schoolClassId: 'class',
              },
            },
          ]),
      },
      resultSet: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              id: 'result',
              publishedAt: null,
              publishedById: null,
              results: [],
            },
          ]),
      },
      gradebookLock: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient
    const findings = await checkAcademicDataQuality(database, schoolId)
    expect(findings.map((finding) => finding.code)).toEqual([
      'MARK_OUT_OF_RANGE',
      'PUBLISHED_RESULT_HISTORY_MISSING',
    ])
    expect(Object.keys(database.mark)).toEqual(['findMany'])
    expect(
      findings.some((finding) =>
        /MISSING_MARK_AS_ZERO|RANK/i.test(finding.code),
      ),
    ).toBe(false)
  })
})
