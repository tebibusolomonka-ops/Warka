import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SupportWorkspace } from './SupportWorkspace'
import { getSupportCaseSchools, getSupportCases } from './supportApi'

vi.mock('./supportApi', () => ({
  getSupportCaseSchools: vi.fn(),
  getSupportCases: vi.fn(),
  getSupportCase: vi.fn(),
  createSupportCase: vi.fn(),
  replyToSupportCase: vi.fn(),
  resolveSupportCase: vi.fn(),
  closeSupportCase: vi.fn(),
}))
const schoolId = '123e4567-e89b-42d3-a456-426614174001'
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getSupportCases).mockResolvedValue([])
})
afterEach(cleanup)

describe('support workspace', () => {
  it('hides the support queue without grants and shows only granted schools', async () => {
    vi.mocked(getSupportCaseSchools).mockResolvedValue([])
    const { unmount } = render(<SupportWorkspace baseUrl="/api" />)
    expect(screen.queryByRole('button', { name: 'Warka support' })).toBeNull()
    unmount()
    vi.mocked(getSupportCaseSchools).mockResolvedValueOnce([
      { id: schoolId, name: 'Granted School' },
    ])
    render(<SupportWorkspace baseUrl="/api" />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Warka support' }),
    )
    expect(
      await screen.findByRole('option', { name: 'Granted School' }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Create support request' }),
    ).toBeNull()
  })
})
