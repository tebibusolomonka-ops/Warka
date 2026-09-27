import { afterEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { PrivacyWorkspace } from './PrivacyWorkspace'
import {
  actOnPrivacyRequest,
  getOwnPrivacyRequest,
  getOwnPrivacyRequests,
  getPrivacySubjects,
  getStaffPrivacyRequests,
  submitPrivacyRequest,
} from './privacyApi'

vi.mock('./privacyApi', () => ({
  actOnPrivacyRequest: vi.fn(),
  cancelPrivacyRequest: vi.fn(),
  getOwnPrivacyRequest: vi.fn(),
  getOwnPrivacyRequests: vi.fn(),
  getPrivacySubjects: vi.fn(),
  getStaffPrivacyRequests: vi.fn(),
  submitPrivacyRequest: vi.fn(),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
const schoolId = '123e4567-e89b-42d3-a456-426614174001'
const studentId = '123e4567-e89b-42d3-a456-426614174002'
const requestId = '123e4567-e89b-42d3-a456-426614174003'
const baseUrl = 'http://localhost:3000/api'
const request = {
  id: requestId,
  schoolId,
  studentId,
  type: 'access' as const,
  status: 'fulfilled' as const,
  details: 'Please provide records',
  createdAt: '2026-01-01T00:00:00.000Z',
  reviewedAt: null,
  fulfilledAt: '2026-01-02T00:00:00.000Z',
}

it('submits only for an eligible student and displays a fulfilled package', async () => {
  vi.mocked(getPrivacySubjects).mockResolvedValue([
    {
      schoolId,
      studentId,
      studentReference: 'WKA-1',
      displayName: 'Hana Bekele',
      requesterKind: 'student',
    },
  ])
  vi.mocked(getOwnPrivacyRequests).mockResolvedValue({
    total: 1,
    items: [request],
    take: 25,
    skip: 0,
  })
  vi.mocked(getOwnPrivacyRequest).mockResolvedValue({
    ...request,
    accessPackage: { student: { givenName: 'Hana' } },
  })
  vi.mocked(submitPrivacyRequest).mockResolvedValue(undefined)
  render(
    <PrivacyWorkspace
      baseUrl={baseUrl}
      mode="requester"
      onSessionExpired={vi.fn()}
    />,
  )
  await screen.findByText(/Request concerns Hana Bekele/)
  fireEvent.change(screen.getByLabelText('Details'), {
    target: { value: 'Please provide my records' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Submit request' }))
  await waitFor(() =>
    expect(submitPrivacyRequest).toHaveBeenCalledWith(baseUrl, schoolId, {
      studentId,
      type: 'access',
      details: 'Please provide my records',
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'View access package' }))
  await screen.findByText(/"givenName": "Hana"/)
})

it('shows staff review actions without exposing access package contents', async () => {
  vi.mocked(getStaffPrivacyRequests).mockResolvedValue({
    total: 1,
    items: [
      {
        ...request,
        status: 'submitted',
        requesterKind: 'guardian',
        requester: { displayName: 'Parent' },
        correctionValue: null,
      },
    ],
    take: 25,
    skip: 0,
  })
  vi.mocked(actOnPrivacyRequest).mockResolvedValue(undefined)
  render(
    <PrivacyWorkspace
      baseUrl={baseUrl}
      mode="staff"
      schoolId={schoolId}
      onSessionExpired={vi.fn()}
    />,
  )
  await screen.findByText(/Requester Parent/)
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
  await waitFor(() =>
    expect(actOnPrivacyRequest).toHaveBeenCalledWith(
      baseUrl,
      schoolId,
      requestId,
      'approve',
      '',
    ),
  )
  expect(screen.queryByLabelText('Access package')).toBeNull()
})
