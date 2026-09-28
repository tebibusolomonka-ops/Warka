import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { TeacherMeetingWorkspace } from './TeacherMeetingWorkspace'
import {
  listTeacherMeetings,
  listTeacherMeetingSlots,
  scheduleTeacherMeeting,
  declineTeacherMeeting,
  completeTeacherMeeting,
} from './meetingApi'

vi.mock('./meetingApi', async (original) => ({
  ...(await original<typeof import('./meetingApi')>()),
  listTeacherMeetings: vi.fn(),
  listTeacherMeetingSlots: vi.fn(),
  scheduleTeacherMeeting: vi.fn(),
  declineTeacherMeeting: vi.fn(),
  completeTeacherMeeting: vi.fn(),
}))
const baseUrl = 'http://localhost/api'
const schoolId = '11111111-1111-4111-8111-111111111111'
const meetingId = '22222222-2222-4222-8222-222222222222'
const slotId = '33333333-3333-4333-8333-333333333333'
const slot = {
  id: slotId,
  startsAt: '2026-10-01T10:00:00.000Z',
  endsAt: '2026-10-01T10:30:00.000Z',
  method: 'inPerson' as const,
}

beforeEach(() => {
  vi.mocked(listTeacherMeetingSlots)
    .mockReset()
    .mockResolvedValue({ slots: [slot] })
  vi.mocked(listTeacherMeetings)
    .mockReset()
    .mockResolvedValue({
      meetings: [
        {
          id: meetingId,
          studentId: schoolId,
          teacherId: schoolId,
          topic: 'Discuss coursework',
          status: 'requested',
          scheduledStartAt: null,
          scheduledEndAt: null,
          meetingMethod: null,
          schoolLocation: null,
          student: { givenName: 'Sample', familyName: 'Learner' },
        },
      ],
      nextCursor: null,
    })
  vi.mocked(scheduleTeacherMeeting).mockReset().mockResolvedValue({})
  vi.mocked(declineTeacherMeeting).mockReset().mockResolvedValue({})
  vi.mocked(completeTeacherMeeting).mockReset().mockResolvedValue({})
})
afterEach(cleanup)
const show = () =>
  render(
    <TeacherMeetingWorkspace
      baseUrl={baseUrl}
      schoolId={schoolId}
      onSessionExpired={vi.fn()}
    />,
  )

describe('teacher family meeting workspace', () => {
  it('shows school-only availability and schedules the selected request', async () => {
    show()
    expect(await screen.findByText(/Discuss coursework/)).toBeTruthy()
    expect(screen.getByText(/do not show a personal calendar/)).toBeTruthy()
    expect(screen.getByText('Sample Learner')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('School meeting window'), {
      target: { value: slotId },
    })
    fireEvent.change(screen.getByLabelText('School location'), {
      target: { value: 'School office' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }))
    await waitFor(() =>
      expect(scheduleTeacherMeeting).toHaveBeenCalledWith(
        baseUrl,
        schoolId,
        meetingId,
        slotId,
        'School office',
      ),
    )
  })

  it('declines only with a reason and distinguishes completed status', async () => {
    show()
    await screen.findByText(/Discuss coursework/)
    expect(
      screen.getByRole('button', { name: 'Decline' }).hasAttribute('disabled'),
    ).toBe(true)
    fireEvent.change(screen.getByLabelText('Decline reason'), {
      target: { value: 'Please contact school' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    await waitFor(() =>
      expect(declineTeacherMeeting).toHaveBeenCalledWith(
        baseUrl,
        schoolId,
        meetingId,
        'Please contact school',
      ),
    )
  })
})
