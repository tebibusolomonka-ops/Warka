import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import type { IssuedDocument } from '@warka/database'
import { renderReportCard, reportCardContent } from './documentPdf.js'

const snapshot = {
  student: { displayName: 'Sample Student', studentReference: 'WRK-123' },
  issuingSchool: 'Sample Academy',
  schoolContact: {
    city: 'Addis Ababa',
    phone: '+251 000 000',
    documentFooter: 'Official copy',
  },
  documentType: 'reportCard',
  issuedAt: '2026-09-26T10:00:00.000Z',
  academicYear: '2025/26',
  subjects: [
    {
      subject: 'Mathematics',
      gradingPeriod: 'Term 1',
      percentage: 92,
      gradeLabel: 'A',
    },
  ],
}
const document = (overrides: Record<string, unknown> = {}) =>
  ({
    documentType: 'reportCard',
    verificationReference: 'WRK-VERIFY-1',
    snapshot,
    ...overrides,
  }) as IssuedDocument

describe('report card PDFs', () => {
  it('generates a valid one-page PDF from an issued snapshot', async () => {
    const bytes = await renderReportCard(document())
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-')
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBe(1)
  })

  it('excludes private record fields and rejects private snapshot fields', () => {
    const issued = document({ auditMetadata: 'PRIVATE', password: 'PRIVATE' })
    const content = reportCardContent(issued)
    expect(content.snapshot.student.displayName).toBe('Sample Student')
    expect(content.snapshot.issuingSchool).toBe('Sample Academy')
    expect(JSON.stringify(content)).not.toContain('PRIVATE')
    expect(() =>
      reportCardContent(
        document({ snapshot: { ...snapshot, guardianPhone: 'PRIVATE' } }),
      ),
    ).toThrow()
  })
  it('renders current and corrected historical documents from their own snapshots', async () => {
    const old = document({ status: 'corrected', snapshot })
    const current = document({
      snapshot: {
        ...snapshot,
        student: { ...snapshot.student, displayName: 'Updated Student' },
      },
    })
    expect(reportCardContent(old).snapshot.student.displayName).toBe(
      'Sample Student',
    )
    expect(reportCardContent(current).snapshot.student.displayName).toBe(
      'Updated Student',
    )
    expect(
      (await PDFDocument.load(await renderReportCard(old))).getPageCount(),
    ).toBe(1)
    expect(
      (await PDFDocument.load(await renderReportCard(current))).getPageCount(),
    ).toBe(1)
  })
})
