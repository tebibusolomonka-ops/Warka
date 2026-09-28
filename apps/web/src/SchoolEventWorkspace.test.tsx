import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SchoolEventWorkspace } from './SchoolEventWorkspace'
import {
  createEvent,
  listManagedEvents,
  setEventAudience,
  transitionEvent,
} from './eventApi'
import { getAcademicStructure } from './academicApi'

vi.mock('./eventApi', () => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  listManagedEvents: vi.fn(),
  setEventAudience: vi.fn(),
  setEventRsvp: vi.fn(),
  transitionEvent: vi.fn(),
  listEventAttachments: vi.fn().mockResolvedValue({ attachments: [] }),
  eventResponseCounts: vi.fn().mockResolvedValue({ going: 2, notGoing: 1 }),
  uploadEventAttachment: vi.fn(),
}))
vi.mock('./academicApi', () => ({ getAcademicStructure: vi.fn() }))
const schoolId = '11111111-1111-4111-8111-111111111111'
const eventId = '22222222-2222-4222-8222-222222222222'
const draft = {
  id: eventId,
  schoolId,
  title: 'Open day',
  description: 'Welcome',
  startsAt: '2026-10-01T09:00:00Z',
  endsAt: '2026-10-01T10:00:00Z',
  schoolLocation: null,
  status: 'draft',
  rsvpEnabled: false,
  audience: null,
}

beforeEach(() => {
  vi.mocked(listManagedEvents).mockReset().mockResolvedValue({ events: [] })
  vi.mocked(getAcademicStructure).mockReset().mockResolvedValue({
    classes: [],
    academicYears: [],
    gradingPeriods: [],
    subjects: [],
    teachers: [],
    role: 'administrator',
  })
  vi.mocked(createEvent)
    .mockReset()
    .mockResolvedValue(draft as never)
  vi.mocked(setEventAudience).mockReset().mockResolvedValue({})
  vi.mocked(transitionEvent).mockReset().mockResolvedValue({})
})
afterEach(cleanup)

describe('school event workspace', () => {
  it('creates a dated draft and keeps actor identity server controlled', async () => {
    render(<SchoolEventWorkspace baseUrl="" schoolId={schoolId} />)
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Open day' },
    })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Welcome' },
    })
    fireEvent.change(screen.getByLabelText('Starts'), {
      target: { value: '2026-10-01T09:00' },
    })
    fireEvent.change(screen.getByLabelText('Ends'), {
      target: { value: '2026-10-01T10:00' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() =>
      expect(createEvent).toHaveBeenCalledWith(
        '',
        schoolId,
        expect.objectContaining({ title: 'Open day' }),
      ),
    )
    expect(vi.mocked(createEvent).mock.calls[0]?.[2]).not.toHaveProperty(
      'createdById',
    )
  })

  it('requires an audience before offering publication and shows aggregate counts', async () => {
    vi.mocked(listManagedEvents).mockResolvedValue({ events: [draft as never] })
    render(<SchoolEventWorkspace baseUrl="" schoolId={schoolId} />)
    fireEvent.change(await screen.findByLabelText('Event'), {
      target: { value: eventId },
    })
    expect(
      (
        screen.getByRole('button', {
          name: 'Publish event',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)
    expect(await screen.findByText(/2 going, 1 not going/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save audience' }))
    await waitFor(() =>
      expect(setEventAudience).toHaveBeenCalledWith('', schoolId, eventId, {
        scope: 'wholeSchool',
      }),
    )
    expect(transitionEvent).not.toHaveBeenCalled()
  })
})
