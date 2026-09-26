import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import type { IssuedDocument } from '@warka/database'
import { renderTranscript, transcriptContent } from './documentPdf.js'

const subject = (
  academicYear: string,
  gradingPeriod: string,
  index: number,
) => ({
  academicYear,
  gradingPeriod,
  subject: `Subject ${index}`,
  percentage: 80,
  gradeLabel: 'B',
})
const snapshot = {
  student: { displayName: 'Sample Student', studentReference: 'WRK-123' },
  issuingSchool: 'Sample Academy',
  documentType: 'transcript',
  issuedAt: '2026-09-26T10:00:00.000Z',
  academicYear: '2025/26',
  subjects: [subject('2025/26', 'Term 1', 1)],
}
const document = (subjects = snapshot.subjects) =>
  ({
    documentType: 'transcript',
    verificationReference: 'WRK-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    snapshot: { ...snapshot, subjects },
  }) as IssuedDocument

describe('transcript PDFs', () => {
  it('renders a single period', async () => {
    const bytes = await renderTranscript(document(), {
      PUBLIC_BASE_URL: 'https://example.test/',
    })
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-')
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })
  it('retains multiple academic years and periods from the snapshot', async () => {
    const issued = document([
      subject('2024/25', 'Term 2', 1),
      subject('2025/26', 'Term 1', 2),
    ])
    expect(
      transcriptContent(issued).snapshot.subjects.map(
        (item) => item.academicYear,
      ),
    ).toEqual(['2024/25', '2025/26'])
    expect(
      (
        await PDFDocument.load(
          await renderTranscript(issued, {
            PUBLIC_BASE_URL: 'https://example.test/',
          }),
        )
      ).getPageCount(),
    ).toBe(1)
  })
  it('continues long transcripts across pages without dropping subjects', async () => {
    const subjects = Array.from({ length: 90 }, (_, index) =>
      subject('2025/26', 'Term 1', index),
    )
    expect(
      transcriptContent(document(subjects)).snapshot.subjects,
    ).toHaveLength(90)
    expect(
      (
        await PDFDocument.load(
          await renderTranscript(document(subjects), {
            PUBLIC_BASE_URL: 'https://example.test/',
          }),
        )
      ).getPageCount(),
    ).toBeGreaterThan(1)
  })
})
