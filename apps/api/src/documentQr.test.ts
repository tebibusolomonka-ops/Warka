import { describe, expect, it } from 'vitest'
import { PDFDocument, PDFName } from 'pdf-lib'
import {
  documentVerificationQr,
  documentVerificationUrl,
} from './documentQr.js'
import { renderReportCard, renderTranscript } from './documentPdf.js'
import type { IssuedDocument } from '@warka/database'

const reference = 'WRK-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const env = { PUBLIC_BASE_URL: 'https://example.test/warka/' }
const document = (type: 'reportCard' | 'transcript') =>
  ({
    documentType: type,
    verificationReference: reference,
    snapshot: {
      student: {
        displayName: 'Private Student',
        studentReference: 'PRIVATE-1',
      },
      issuingSchool: 'Sample School',
      documentType: type,
      issuedAt: '2026-09-26T10:00:00.000Z',
      academicYear: '2025/26',
      subjects: [
        {
          subject: 'Mathematics',
          gradingPeriod: 'Term 1',
          percentage: 90,
          gradeLabel: 'A',
        },
      ],
    },
  }) as IssuedDocument

describe('document verification QR', () => {
  it('uses the public route and excludes private data', async () => {
    const url = documentVerificationUrl(reference, env)
    expect(url).toBe(`https://example.test/warka/verify/documents/${reference}`)
    expect(url).not.toContain('PRIVATE')
    expect(await documentVerificationQr(reference, env)).toMatch(
      /^data:image\/png;base64,/,
    )
  })
  it('rejects malformed public base URLs', () => {
    for (const url of [
      'invalid',
      'ftp://example.test',
      'https://user:pass@example.test',
      'https://example.test/?secret=1',
    ]) {
      expect(() =>
        documentVerificationUrl(reference, { PUBLIC_BASE_URL: url }),
      ).toThrow()
    }
  })
  it.each(['reportCard', 'transcript'] as const)(
    'embeds QR in %s PDF',
    async (type) => {
      const bytes =
        type === 'reportCard'
          ? await renderReportCard(document(type), env)
          : await renderTranscript(document(type), env)
      const pdf = await PDFDocument.load(bytes)
      const resources = pdf.getPage(0).node.Resources()
      expect(resources?.lookup(PDFName.of('XObject'))).toBeDefined()
    },
  )
})
