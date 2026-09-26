import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { StudentDocuments } from './StudentDocuments'
import {
  cancelStudentDocument,
  getStudentDocumentWorkspace,
  requestStudentDocument,
} from './studentDocumentApi'

vi.mock('./studentDocumentApi', () => ({
  getStudentDocumentWorkspace: vi.fn(),
  requestStudentDocument: vi.fn(),
  cancelStudentDocument: vi.fn(),
}))
const schoolId = '123e4567-e89b-42d3-a456-426614174001'
const yearId = '123e4567-e89b-42d3-a456-426614174002'
const requestId = '123e4567-e89b-42d3-a456-426614174003'
const documentId = '123e4567-e89b-42d3-a456-426614174004'
const reference = 'WRK-' + 'A'.repeat(32)
const base = {
  eligibleYears: [
    {
      schoolId,
      school: 'Sample school',
      academicYearId: yearId,
      academicYear: '2025/26',
    },
  ],
  requests: [],
}
const item = {
  id: requestId,
  schoolId,
  documentType: 'reportCard' as const,
  status: 'requested' as const,
  requestedAt: '2026-09-26T10:00:00.000Z',
  rejectionReason: null,
  issuedDocumentId: null,
  verificationReference: null,
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getStudentDocumentWorkspace).mockResolvedValue(base)
  vi.mocked(requestStudentDocument).mockResolvedValue(undefined)
  vi.mocked(cancelStudentDocument).mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('student documents', () => {
  it('shows empty state and submits a document request', async () => {
    render(<StudentDocuments baseUrl="/api" onSessionExpired={vi.fn()} />)
    expect(await screen.findByText('No document requests yet.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Request document' }))
    await waitFor(() =>
      expect(requestStudentDocument).toHaveBeenCalledWith(
        '/api',
        schoolId,
        yearId,
        'reportCard',
      ),
    )
  })
  it('shows request status and cancels an eligible request', async () => {
    vi.mocked(getStudentDocumentWorkspace).mockResolvedValue({
      ...base,
      requests: [item],
    })
    render(<StudentDocuments baseUrl="/api" onSessionExpired={vi.fn()} />)
    expect(await screen.findByText(/requested/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
    await waitFor(() =>
      expect(cancelStudentDocument).toHaveBeenCalledWith('/api', requestId),
    )
  })
  it('shows ready download and verification links', async () => {
    vi.mocked(getStudentDocumentWorkspace).mockResolvedValue({
      ...base,
      requests: [
        {
          ...item,
          status: 'ready',
          issuedDocumentId: documentId,
          verificationReference: reference,
        },
      ],
    })
    render(<StudentDocuments baseUrl="/api" onSessionExpired={vi.fn()} />)
    expect(
      (await screen.findByRole('link', { name: 'Download PDF' })).getAttribute(
        'href',
      ),
    ).toBe(`/api/schools/${schoolId}/documents/${documentId}/download`)
    expect(
      screen.getByText(`Verification reference: ${reference}`),
    ).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: 'Verify document' })
        .getAttribute('href'),
    ).toBe(`/verify/${reference}`)
  })
  it('shows rejection reason without staff actions', async () => {
    vi.mocked(getStudentDocumentWorkspace).mockResolvedValue({
      ...base,
      requests: [
        {
          ...item,
          status: 'rejected',
          rejectionReason: 'Official result unavailable',
        },
      ],
    })
    render(<StudentDocuments baseUrl="/api" onSessionExpired={vi.fn()} />)
    expect(
      await screen.findByText('Reason: Official result unavailable'),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Issue' })).toBeNull()
  })
})
