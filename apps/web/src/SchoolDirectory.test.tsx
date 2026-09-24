import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { SchoolDirectory } from './SchoolDirectory'
import { getSchools, postOrganization, postSchool } from './api'

vi.mock('./api', () => ({
  apiBaseUrl: () => 'http://localhost/api',
  getSchools: vi.fn(),
  postOrganization: vi.fn(),
  postSchool: vi.fn(),
}))

const organizationId = '123e4567-e89b-42d3-a456-426614174000'
const schoolId = '123e4567-e89b-42d3-a456-426614174001'
const now = '2026-09-24T00:00:00.000Z'

beforeEach(() => {
  window.localStorage.clear()
  vi.resetAllMocks()
})

afterEach(cleanup)

describe('school directory', () => {
  it('creates an organization and shows an empty directory', async () => {
    vi.mocked(postOrganization).mockResolvedValue({
      id: organizationId,
      name: 'Regional office',
      createdAt: now,
      updatedAt: now,
    })
    vi.mocked(getSchools).mockResolvedValue([])

    render(<SchoolDirectory />)
    fireEvent.change(screen.getByLabelText('New organization name'), {
      target: { value: ' Regional office ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create organization' }))

    await screen.findByText('No schools yet')
    expect(postOrganization).toHaveBeenCalledWith(
      'http://localhost/api',
      'Regional office',
    )
    expect(window.localStorage.getItem('warka.organizationId')).toBe(
      organizationId,
    )
  })

  it('loads schools and refreshes after creating one', async () => {
    window.localStorage.setItem('warka.organizationId', organizationId)
    const first = {
      id: schoolId,
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
    vi.mocked(getSchools)
      .mockResolvedValueOnce([first])
      .mockResolvedValueOnce([first, second])
    vi.mocked(postSchool).mockResolvedValue(second)

    render(<SchoolDirectory />)
    await screen.findByText('First school')

    fireEvent.change(screen.getByLabelText('School name'), {
      target: { value: ' Second school ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create school' }))

    await screen.findByText('Second school')
    expect(postSchool).toHaveBeenCalledWith(
      'http://localhost/api',
      organizationId,
      'Second school',
    )
    expect(getSchools).toHaveBeenCalledTimes(2)
  })

  it('shows a request failure and allows changing organizations', async () => {
    window.localStorage.setItem('warka.organizationId', organizationId)
    vi.mocked(getSchools).mockRejectedValue(new Error('offline'))

    render(<SchoolDirectory />)
    await screen.findByRole('alert')
    expect(screen.getByText('Could not load schools')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Change organization' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Organization ID')).toBeTruthy(),
    )
    expect(window.localStorage.getItem('warka.organizationId')).toBeNull()
  })
})
