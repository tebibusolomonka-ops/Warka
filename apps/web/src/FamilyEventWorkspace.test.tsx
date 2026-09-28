import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { FamilyEventWorkspace } from './FamilyEventWorkspace'
import {
  getFamilyEvent,
  listFamilyEvents,
  respondToFamilyEvent,
} from './eventApi'

vi.mock('./eventApi', () => ({
  getFamilyEvent: vi.fn(),
  listFamilyEvents: vi.fn(),
  respondToFamilyEvent: vi.fn(),
  eventDownloadUrl: vi.fn().mockReturnValue('/safe-download'),
}))
const schoolId = '11111111-1111-4111-8111-111111111111'
const studentId = '22222222-2222-4222-8222-222222222222'
const eventId = '33333333-3333-4333-8333-333333333333'
const event = {
  id: eventId,
  schoolId,
  title: 'Open day',
  description: 'Visit our classrooms',
  startsAt: '2027-10-01T09:00:00Z',
  endsAt: '2027-10-01T10:00:00Z',
  schoolLocation: 'School hall',
  status: 'published',
  rsvpEnabled: true,
  responseStatus: 'going',
  attachments: [
    { id: 'a', originalFileName: 'Guide.pdf', available: true },
    { id: 'b', originalFileName: 'Pending.pdf', available: false },
  ],
} as const
beforeEach(() => {
  vi.mocked(listFamilyEvents)
    .mockReset()
    .mockResolvedValue({ events: [event as never] })
  vi.mocked(getFamilyEvent)
    .mockReset()
    .mockResolvedValue(event as never)
  vi.mocked(respondToFamilyEvent).mockReset().mockResolvedValue({})
})
afterEach(cleanup)

describe('family events', () => {
  it('keeps linked child context and only links available files', async () => {
    render(
      <FamilyEventWorkspace
        baseUrl=""
        schoolId={schoolId}
        studentId={studentId}
        childName="Hana"
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Open day' }))
    expect(await screen.findByText('Visit our classrooms')).toBeTruthy()
    expect(screen.getByText('Events for Hana')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Guide.pdf' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Pending.pdf' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Not going' }))
    await waitFor(() =>
      expect(respondToFamilyEvent).toHaveBeenCalledWith(
        '',
        schoolId,
        eventId,
        'notGoing',
        studentId,
      ),
    )
    expect(screen.getByText(/RSVP does not record attendance/)).toBeTruthy()
  })

  it('uses the student self path without a child identifier', async () => {
    render(<FamilyEventWorkspace baseUrl="" schoolId={schoolId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Open day' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Going' }))
    await waitFor(() =>
      expect(respondToFamilyEvent).toHaveBeenCalledWith(
        '',
        schoolId,
        eventId,
        'going',
        undefined,
      ),
    )
  })
})
