import { afterEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { FileSecurityWorkspace } from './FileSecurityWorkspace'
import {
  listFileSecurityScans,
  rescanFileAsset,
  removeQuarantinedAsset,
} from './operationsApi'

vi.mock('./operationsApi', () => ({
  listFileSecurityScans: vi.fn(),
  rescanFileAsset: vi.fn(),
  removeQuarantinedAsset: vi.fn(),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it('shows quarantined metadata and restricted remediation without a download action', async () => {
  const assetId = '123e4567-e89b-42d3-a456-426614174001'
  vi.mocked(listFileSecurityScans).mockResolvedValue([
    {
      id: '123e4567-e89b-42d3-a456-426614174002',
      scanner: 'test',
      status: 'infected',
      result: 'infected',
      failureCode: null,
      startedAt: null,
      completedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      fileAsset: {
        id: assetId,
        schoolId: null,
        purpose: 'learningMaterial',
        status: 'quarantined',
        originalFileName: 'lesson.pdf',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    },
  ])
  vi.mocked(rescanFileAsset).mockResolvedValue({})
  vi.mocked(removeQuarantinedAsset).mockResolvedValue(null)
  render(<FileSecurityWorkspace baseUrl="/api" />)
  await screen.findByText(/lesson.pdf/)
  expect(screen.queryByRole('link', { name: /download/i })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Rescan' }))
  await waitFor(() =>
    expect(rescanFileAsset).toHaveBeenCalledWith('/api', assetId),
  )
})
