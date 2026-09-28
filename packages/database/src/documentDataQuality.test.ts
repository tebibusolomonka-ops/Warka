import type { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { checkDocumentDataQuality } from './documentDataQuality.js'

const schoolId = '11111111-1111-4111-8111-111111111111'
const snapshot = {
  student: { displayName: 'Historical name', studentReference: 'WKA-OLD' },
  issuingSchool: 'School',
  documentType: 'reportCard',
  issuedAt: '2026-01-01T00:00:00.000Z',
  academicYear: '2025',
  subjects: [
    {
      subject: 'Math',
      gradingPeriod: 'Term 1',
      percentage: 80,
      gradeLabel: 'B',
    },
  ],
}
describe('document data quality', () => {
  it('accepts an immutable historical snapshot without comparing mutable student values', async () => {
    const database = {
      issuedDocument: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              id: 'document',
              schoolId,
              studentId: 'student',
              documentType: 'reportCard',
              snapshot,
              verificationReference: 'WRK-123',
              status: 'active',
              supersedesId: null,
              supersedes: null,
              fileAsset: null,
              withdrawnAt: null,
            },
          ]),
      },
    } as unknown as PrismaClient
    expect(await checkDocumentDataQuality(database, schoolId)).toEqual([])
    expect(Object.keys(database.issuedDocument)).toEqual(['findMany'])
  })
  it('reports invalid snapshot and broken correction context without exposing contents', async () => {
    const database = {
      issuedDocument: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              id: 'document',
              schoolId,
              studentId: 'student',
              documentType: 'reportCard',
              snapshot: {},
              verificationReference: '',
              status: 'active',
              supersedesId: 'prior',
              supersedes: {
                id: 'prior',
                schoolId: 'other',
                studentId: 'student',
                documentType: 'reportCard',
              },
              fileAsset: null,
              withdrawnAt: null,
            },
          ]),
      },
    } as unknown as PrismaClient
    expect(
      (await checkDocumentDataQuality(database, schoolId)).map(
        (finding) => finding.code,
      ),
    ).toEqual([
      'DOCUMENT_SNAPSHOT_INVALID',
      'DOCUMENT_VERIFICATION_REFERENCE_MISSING',
      'DOCUMENT_VERSION_RELATIONSHIP_INVALID',
    ])
  })
})
