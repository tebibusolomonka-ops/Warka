import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { GuardianMeetingWorkspace } from './GuardianMeetingWorkspace'
import {
  cancelGuardianMeeting,
  listChildMeetingTeachers,
  listChildTeacherSlots,
  listGuardianMeetings,
  requestGuardianMeeting,
} from './meetingApi'

vi.mock('./meetingApi', async (original) => ({
  ...(await original<typeof import('./meetingApi')>()),
  cancelGuardianMeeting: vi.fn(),
  listChildMeetingTeachers: vi.fn(),
  listChildTeacherSlots: vi.fn(),
  listGuardianMeetings: vi.fn(),
  requestGuardianMeeting: vi.fn(),
}))
const schoolId = '11111111-1111-4111-8111-111111111111'
const studentId = '22222222-2222-4222-8222-222222222222'
const otherStudent = '33333333-3333-4333-8333-333333333333'
const teacherId = '44444444-4444-4444-8444-444444444444'
const assignmentId = '55555555-5555-4555-8555-555555555555'
const meetingId = '66666666-6666-4666-8666-666666666666'
beforeEach(() => {
  vi.mocked(listChildMeetingTeachers)
    .mockReset()
    .mockResolvedValue({
      teachers: [
        {
          assignmentId,
          teacherId,
          teacherName: 'Ms. Teacher',
          subjectName: 'Math',
        },
      ],
    })
  vi.mocked(listChildTeacherSlots)
    .mockReset()
    .mockResolvedValue({
      slots: [
        {
          id: meetingId,
          startsAt: '2026-10-01T10:00:00.000Z',
          endsAt: '2026-10-01T10:30:00.000Z',
          method: 'inPerson',
        },
      ],
    })
  vi.mocked(listGuardianMeetings)
    .mockReset()
    .mockResolvedValue({
      meetings: [
        {
          id: meetingId,
          studentId,
          teacherId,
          topic: 'Coursework',
          status: 'scheduled',
          scheduledStartAt: '2026-10-01T10:00:00.000Z',
          scheduledEndAt: '2026-10-01T10:30:00.000Z',
          meetingMethod: 'inPerson',
          schoolLocation: 'School office',
          events: [],
        },
        {
          id: otherStudent,
          studentId: otherStudent,
          teacherId,
          topic: 'Other child private topic',
          status: 'requested',
          scheduledStartAt: null,
          scheduledEndAt: null,
          meetingMethod: null,
          schoolLocation: null,
        },
      ],
      nextCursor: null,
    })
  vi.mocked(requestGuardianMeeting).mockReset().mockResolvedValue({})
  vi.mocked(cancelGuardianMeeting).mockReset().mockResolvedValue({})
})
afterEach(cleanup)

describe('guardian meeting workspace', () => {
  it('keeps linked child context separate and uses selected teacher assignment', async () => {
    render(
      <GuardianMeetingWorkspace
        baseUrl="/api"
        schoolId={schoolId}
        studentId={studentId}
        childName="Hana"
        onSessionExpired={vi.fn()}
      />,
    )
    expect(await screen.findByText(/Coursework/)).toBeTruthy()
    expect(screen.queryByText(/Other child private topic/)).toBeNull()
    fireEvent.change(screen.getByLabelText('Current teacher'), {
      target: { value: assignmentId },
    })
    await waitFor(() =>
      expect(listChildTeacherSlots).toHaveBeenCalledWith(
        '/api',
        schoolId,
        studentId,
        teacherId,
      ),
    )
    fireEvent.change(screen.getByLabelText('Topic'), {
      target: { value: 'Discuss homework' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Request meeting' }))
    await waitFor(() =>
      expect(requestGuardianMeeting).toHaveBeenCalledWith(
        '/api',
        schoolId,
        studentId,
        assignmentId,
        'Discuss homework',
      ),
    )
  })
})
