import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { App } from './App'
import { DocumentVerificationPage } from './DocumentVerificationPage'
import { getCurrentUser, verifyDocument } from './api'

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return {
    ...actual,
    getCurrentUser: vi.fn(),
    verifyDocument: vi.fn(),
  }
})

const reference = 'WRK-' + 'A'.repeat(32)
const active = {
  status: 'active' as const,
  documentType: 'transcript' as const,
  issuingSchool: 'Issuing School',
  student: { displayName: 'Mira Learner', studentReference: 'WKA-1' },
  issuedAt: '2026-09-25T08:00:00.000Z',
  academicYear: '2026',
  subjects: [
    {
      subject: 'Mathematics',
      gradingPeriod: 'Term 1',
      percentage: 85,
      gradeLabel: 'B',
    },
  ],
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('VITE_API_URL', '/api')
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  window.history.replaceState(null, '', '/')
})

describe('public document verification page', () => {
  it('opens a direct QR-friendly route without authenticating and shows active details', async () => {
    vi.mocked(verifyDocument).mockResolvedValue(active)
    window.history.replaceState(null, '', '/verify/' + reference)
    render(<App />)
    expect(
      await screen.findByRole('heading', { name: 'Verified Warka record' }),
    ).toBeTruthy()
    expect(screen.getByText('Issuing School')).toBeTruthy()
    expect(screen.getByText('Mira Learner')).toBeTruthy()
    expect(screen.getByText(/Mathematics: 85%/)).toBeTruthy()
    expect(getCurrentUser).not.toHaveBeenCalled()
    expect(verifyDocument).toHaveBeenCalledWith(expect.any(String), reference)
  })

  it.each([
    ['corrected', /document version was corrected/i],
    ['withdrawn', /document was withdrawn/i],
    ['unavailable', /cannot verify this reference/i],
  ] as const)('shows neutral %s state', async (status, message) => {
    vi.mocked(verifyDocument).mockResolvedValue({ status })
    render(<DocumentVerificationPage />)
    fireEvent.change(screen.getByLabelText('Verification reference'), {
      target: { value: reference },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check reference' }))
    expect(await screen.findByText(message)).toBeTruthy()
  })

  it('handles malformed input without requesting a record', async () => {
    render(<DocumentVerificationPage />)
    fireEvent.change(screen.getByLabelText('Verification reference'), {
      target: { value: 'bad-reference' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check reference' }))
    expect(
      await screen.findByText(/cannot verify this reference/i),
    ).toBeTruthy()
    expect(verifyDocument).not.toHaveBeenCalled()
  })

  it('shows a retryable network failure', async () => {
    vi.mocked(verifyDocument).mockRejectedValue(new Error('network'))
    render(<DocumentVerificationPage />)
    fireEvent.change(screen.getByLabelText('Verification reference'), {
      target: { value: reference },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check reference' }))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Could not reach the verification service. Try again.',
    )
  })
})
