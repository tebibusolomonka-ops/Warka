import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import { prismaDocumentVerificationService } from './documentVerificationService.js'

const reference = 'WRK-' + 'A'.repeat(32)
const snapshot = {
  documentType: 'transcript',
  issuingSchool: 'School',
  schoolContact: { email: 'private@example.test' },
  student: { displayName: 'Sample Student', studentReference: 'ST-1' },
  issuedAt: '2026-09-26T10:00:00.000Z',
  academicYear: '2025/26',
  subjects: [
    {
      subject: 'Math',
      gradingPeriod: 'Term 1',
      academicYear: '2024/25',
      percentage: 90,
      gradeLabel: 'A',
    },
  ],
}
const database = {
  issuedDocument: {
    findUnique: vi.fn(async () => ({
      id: 'issued',
      schoolId: 'school',
      status: 'active',
      snapshot,
    })),
  },
  verificationEvent: { create: vi.fn(async () => ({})) },
} as unknown as PrismaClient

describe('public verification contract', () => {
  it('exposes transcript year without private school contact', async () => {
    const value =
      await prismaDocumentVerificationService(database).verify(reference)
    expect(value.status).toBe('active')
    if (value.status !== 'active') throw new Error('Expected active')
    expect(value.subjects[0]?.academicYear).toBe('2024/25')
    expect(JSON.stringify(value)).not.toContain('private@example.test')
    expect(value).not.toHaveProperty('schoolContact')
  })
})
