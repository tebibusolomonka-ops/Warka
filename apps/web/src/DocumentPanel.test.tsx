import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { DocumentPanel } from './DocumentPanel'
import {
  actOnStudentDocument,
  getStudentDocuments,
  issueStudentDocument,
} from './documentApi'

vi.mock('./documentApi', () => ({
  getStudentDocuments: vi.fn(),
  issueStudentDocument: vi.fn(),
  actOnStudentDocument: vi.fn(),
}))

const schoolId = '123e4567-e89b-42d3-a456-426614174001'
const studentId = '123e4567-e89b-42d3-a456-426614174002'
const documentId = '123e4567-e89b-42d3-a456-426614174003'
const yearId = '123e4567-e89b-42d3-a456-426614174004'
const reference = 'WRK-' + 'A'.repeat(32)
const document = {
  id: documentId,
  documentType: 'transcript' as const,
  verificationReference: reference,
  status: 'active' as const,
  issuedAt: '2026-09-25T08:00:00.000Z',
  supersedesId: null,
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getStudentDocuments).mockResolvedValue({
    documents: [document],
    eligibleYears: [{ id: yearId, name: '2026' }],
  })
  vi.mocked(issueStudentDocument).mockResolvedValue(document)
  vi.mocked(actOnStudentDocument).mockResolvedValue(document)
})
afterEach(cleanup)

describe('issued document panel', () => {
  it('issues, corrects, withdraws, and links a document with a reason', async () => {
    render(
      <DocumentPanel
        baseUrl="/api"
        schoolId={schoolId}
        studentId={studentId}
        onSessionExpired={vi.fn()}
      />,
    )
    expect(
      await screen.findByText('Verification reference: ' + reference),
    ).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: 'Open public verification' })
        .getAttribute('href'),
    ).toBe('/verify/' + reference)
    fireEvent.change(screen.getByLabelText('Document type'), {
      target: { value: 'transcript' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Issue document' }))
    await waitFor(() =>
      expect(issueStudentDocument).toHaveBeenCalledWith(
        '/api',
        schoolId,
        studentId,
        yearId,
        'transcript',
      ),
    )
    await screen.findByRole('button', { name: 'Correct document' })
    fireEvent.change(await screen.findByLabelText('Reason for ' + reference), {
      target: { value: 'Official correction' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Correct document' }))
    await waitFor(() =>
      expect(actOnStudentDocument).toHaveBeenCalledWith(
        '/api',
        schoolId,
        documentId,
        'correct',
        'Official correction',
      ),
    )
    await screen.findByRole('button', { name: 'Withdraw document' })
    fireEvent.change(await screen.findByLabelText('Reason for ' + reference), {
      target: { value: 'Issued in error' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw document' }))
    await waitFor(() =>
      expect(actOnStudentDocument).toHaveBeenCalledWith(
        '/api',
        schoolId,
        documentId,
        'withdraw',
        'Issued in error',
      ),
    )
  })

  it('requires a reason before correction or withdrawal', async () => {
    render(
      <DocumentPanel
        baseUrl="/api"
        schoolId={schoolId}
        studentId={studentId}
        onSessionExpired={vi.fn()}
      />,
    )
    await screen.findByText('Verification reference: ' + reference)
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw document' }))
    expect(
      screen.getByText('Enter a reason of at least three characters.'),
    ).toBeTruthy()
    expect(actOnStudentDocument).not.toHaveBeenCalled()
  })
})
