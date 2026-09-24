import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { SchoolDirectory } from './SchoolDirectory'
import { ApiError, getSchools, postSchool } from './api'

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return { ...actual, getSchools: vi.fn(), postSchool: vi.fn() }
})

const baseUrl = 'http://localhost:5173/api'
const organizationId = '123e4567-e89b-42d3-a456-426614174000'
const now = '2026-09-24T00:00:00.000Z'
const first = {
  id: '123e4567-e89b-42d3-a456-426614174001',
  organizationId,
  name: 'First school',
  createdAt: now,
  updatedAt: now,
}
const second = {
  ...first,
  id: '123e4567-e89b-42d3-a456-426614174002',
  name: 'Second school',
}

beforeEach(() => vi.resetAllMocks())
afterEach(cleanup)

function directory(canCreate = true, onSessionExpired = vi.fn()) {
  render(
    <SchoolDirectory
      baseUrl={baseUrl}
      organizationId={organizationId}
      canCreate={canCreate}
      onSessionExpired={onSessionExpired}
    />,
  )
  return onSessionExpired
}

describe('school directory', () => {
  it('shows empty directory and hides creation without administrative access', async () => {
    vi.mocked(getSchools).mockResolvedValue([])
    directory(false)
    await screen.findByText('No schools yet.')
    expect(screen.queryByRole('button', { name: 'Create school' })).toBeNull()
  })

  it('loads schools and refreshes after creation', async () => {
    vi.mocked(getSchools)
      .mockResolvedValueOnce([first])
      .mockResolvedValueOnce([first, second])
    vi.mocked(postSchool).mockResolvedValue(second)
    directory()
    await screen.findByText('First school')
    fireEvent.change(screen.getByLabelText('School name'), {
      target: { value: ' Second school ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create school' }))
    await screen.findByText('Second school')
    expect(postSchool).toHaveBeenCalledWith(
      baseUrl,
      organizationId,
      'Second school',
    )
    expect(getSchools).toHaveBeenCalledTimes(2)
  })

  it('shows network errors and can retry', async () => {
    vi.mocked(getSchools)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([])
    directory()
    await screen.findByText('Could not load schools.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('No schools yet.')
  })

  it('reports an expired session', async () => {
    vi.mocked(getSchools).mockRejectedValue(
      new ApiError('Authentication required', 401, 'UNAUTHENTICATED'),
    )
    const expired = directory()
    await waitFor(() => expect(expired).toHaveBeenCalledOnce())
  })
})
