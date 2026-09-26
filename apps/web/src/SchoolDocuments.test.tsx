import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { SchoolDocuments } from './SchoolDocuments'
import {
  actOnSchoolDocumentRequest,
  getSchoolDocumentProfile,
  getSchoolDocumentRequest,
  listSchoolDocumentRequests,
  listSchoolIssuedDocuments,
} from './schoolDocumentApi'

vi.mock('./schoolDocumentApi', () => ({
  actOnSchoolDocumentRequest: vi.fn(),
  getSchoolDocumentProfile: vi.fn(),
  getSchoolDocumentRequest: vi.fn(),
  listSchoolDocumentRequests: vi.fn(),
  listSchoolIssuedDocuments: vi.fn(),
  saveSchoolDocumentProfile: vi.fn(),
}))
const schoolId = '123e4567-e89b-42d3-a456-426614174001'
const requestId = '123e4567-e89b-42d3-a456-426614174002'
const request = {
  id: requestId,
  student: 'Sample Student',
  studentReference: 'WRK-1',
  documentType: 'transcript' as const,
  academicYear: '2025/26',
  status: 'requested' as const,
  requestedAt: '2026-09-26T10:00:00.000Z',
  rejectionReason: null,
  issuedDocumentId: null,
  verificationReference: null,
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listSchoolDocumentRequests).mockResolvedValue([request])
  vi.mocked(getSchoolDocumentRequest).mockResolvedValue(request)
  vi.mocked(listSchoolIssuedDocuments).mockResolvedValue([])
  vi.mocked(getSchoolDocumentProfile).mockResolvedValue(null)
  vi.mocked(actOnSchoolDocumentRequest).mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('school documents', () => {
  it('shows requests and lets a registrar start processing without issuance', async () => {
    render(
      <SchoolDocuments
        baseUrl="/api"
        schoolId={schoolId}
        canRegister
        canApprove={false}
        onSessionExpired={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Documents' }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: /Sample Student.*Transcript.*requested/,
      }),
    )
    expect(
      screen.queryByRole('button', { name: 'Issue official document' }),
    ).toBeNull()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Start processing' }),
    )
    await waitFor(() =>
      expect(actOnSchoolDocumentRequest).toHaveBeenCalledWith(
        '/api',
        schoolId,
        requestId,
        'start',
        '',
      ),
    )
  })
  it('lets an approver issue a processing request', async () => {
    vi.mocked(listSchoolDocumentRequests).mockResolvedValue([
      { ...request, status: 'processing' },
    ])
    vi.mocked(getSchoolDocumentRequest).mockResolvedValue({
      ...request,
      status: 'processing',
    })
    render(
      <SchoolDocuments
        baseUrl="/api"
        schoolId={schoolId}
        canRegister={false}
        canApprove
        onSessionExpired={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Documents' }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: /Sample Student.*Transcript.*processing/,
      }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Issue official document' }),
    )
    await waitFor(() =>
      expect(actOnSchoolDocumentRequest).toHaveBeenCalledWith(
        '/api',
        schoolId,
        requestId,
        'issue',
        '',
      ),
    )
  })
})
