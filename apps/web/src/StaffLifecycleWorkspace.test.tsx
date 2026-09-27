import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { StaffLifecycleWorkspace } from './StaffLifecycleWorkspace'
import {
  changeStaffStatus,
  getStaffAccess,
  offboardStaffAccess,
} from './staffAccessApi'

vi.mock('./staffAccessApi', () => ({
  changeStaffStatus: vi.fn(),
  getStaffAccess: vi.fn(),
  offboardStaffAccess: vi.fn(),
}))
const schoolId = '123e4567-e89b-42d3-a456-426614174001'
const userId = '123e4567-e89b-42d3-a456-426614174002'
const memberId = '123e4567-e89b-42d3-a456-426614174003'
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getStaffAccess).mockResolvedValue({
    total: 1,
    take: 25,
    skip: 0,
    canManageOrganization: false,
    items: [
      {
        id: memberId,
        email: 'teacher@example.test',
        displayName: 'Teacher',
        accountStatus: 'active',
        organizationMembership: null,
        schoolMembership: {
          role: 'teacher',
          startsAt: new Date('2026-01-01'),
          endsAt: null,
          periodStatus: 'active',
        },
        teachingAssignments: [],
      },
    ],
  })
  vi.mocked(changeStaffStatus).mockResolvedValue()
  vi.mocked(offboardStaffAccess).mockResolvedValue()
})
afterEach(cleanup)

describe('staff lifecycle workspace', () => {
  it('shows current access and requires a reason and confirmation before suspension', async () => {
    render(
      <StaffLifecycleWorkspace
        baseUrl="/api"
        schoolId={schoolId}
        currentUserId={userId}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Staff lifecycle' }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: /Teacher � teacher@example.test/,
      }),
    )
    expect(screen.getByText('School role: teacher (active)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Suspend account' }))
    expect(changeStaffStatus).not.toHaveBeenCalled()
    const confirm = screen.getByRole('button', { name: 'Confirm suspended' })
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Reason'), {
      target: { value: 'Access review' },
    })
    fireEvent.click(confirm)
    await waitFor(() =>
      expect(changeStaffStatus).toHaveBeenCalledWith(
        '/api',
        schoolId,
        memberId,
        'suspended',
        'Access review',
      ),
    )
  })

  it('does not show self-access controls', async () => {
    render(
      <StaffLifecycleWorkspace
        baseUrl="/api"
        schoolId={schoolId}
        currentUserId={memberId}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Staff lifecycle' }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: /Teacher � teacher@example.test/,
      }),
    )
    expect(screen.queryByRole('button', { name: 'Suspend account' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Offboard staff' })).toBeNull()
  })
})
