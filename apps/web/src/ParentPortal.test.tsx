import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ParentPortal } from './ParentPortal'
import {
  getParentChildren,
  getParentResults,
  getParentMaterials,
  getParentAnnouncements,
  getParentCoursework,
  getParentCourseworkSummary,
  getParentConversations,
  getTeacherContacts,
} from './parentApi'

vi.mock('./parentApi', () => ({
  getParentChildren: vi.fn(),
  getParentResults: vi.fn(),
  getParentMaterials: vi.fn(),
  getParentAnnouncements: vi.fn(),
  getParentCoursework: vi.fn(),
  getParentCourseworkSummary: vi.fn(),
  getParentConversations: vi.fn(),
  getTeacherContacts: vi.fn(),
  getParentConversation: vi.fn(),
  createParentConversation: vi.fn(),
  sendParentMessage: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getParentChildren).mockResolvedValue([
    {
      studentId: '123e4567-e89b-42d3-a456-426614174000',
      studentReference: 'WKA-123',
      displayName: 'Hana',
      schoolId: 'school-1',
      school: 'First School',
      academicYear: '2026',
      gradeLevel: 'Grade 2',
      schoolClass: 'A',
      relationship: 'Parent',
    },
  ])
  vi.mocked(getParentResults).mockResolvedValue([
    {
      academicYear: '2026',
      gradingPeriod: 'Term',
      subject: 'Math',
      percentage: 91,
      gradeLabel: 'A',
      publishedAt: '2026-09-24T00:00:00.000Z',
      corrected: true,
    },
  ])
  vi.mocked(getParentMaterials).mockResolvedValue([
    {
      id: '123e4567-e89b-42d3-a456-426614174001',
      title: 'Guide',
      description: null,
      resourceType: 'link',
      resourceLocation: 'https://example.test/guide',
      subject: 'Math',
      academicYear: '2026',
      publishedAt: '2026-09-24T00:00:00.000Z',
    },
  ])
  vi.mocked(getParentAnnouncements).mockResolvedValue([
    {
      id: '123e4567-e89b-42d3-a456-426614174002',
      title: 'Notice',
      body: '<script>alert(1)</script>',
      publishedAt: '2026-09-24T00:00:00.000Z',
      scope: { type: 'school' },
    },
  ])
  vi.mocked(getParentConversations).mockResolvedValue([])
  vi.mocked(getParentCoursework).mockResolvedValue([
    {
      id: 'assignment-1',
      title: 'Essay',
      status: 'published',
      dueAt: '2026-10-01T00:00:00.000Z',
      submissionStatus: 'submitted',
      submittedAt: '2026-09-28T00:00:00.000Z',
      feedback: 'Good work',
      rubricScore: '8',
    },
  ])
  vi.mocked(getParentCourseworkSummary).mockResolvedValue({
    assigned: 1,
    submitted: 1,
    notSubmitted: 0,
    late: 0,
    feedbackAvailable: 1,
  })
  vi.mocked(getTeacherContacts).mockResolvedValue([])
})
afterEach(cleanup)

describe('parent portal workspace', () => {
  it('shows only API-backed child information and renders announcements as text', async () => {
    const { container } = render(
      <ParentPortal
        baseUrl="/api"
        identity={{ displayName: 'Martha' }}
        onSessionExpired={vi.fn()}
        onSignOut={vi.fn()}
      />,
    )
    await screen.findByText('Warka reference: WKA-123')
    expect(screen.getByText('First School')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Results' }))
    await screen.findByText(/Math: 91%/)
    fireEvent.click(screen.getByRole('button', { name: 'Materials' }))
    await screen.findByText('Guide')
    expect(
      screen.getByRole('link', { name: 'Open resource' }).getAttribute('rel'),
    ).toContain('noopener')
    fireEvent.click(screen.getByRole('button', { name: 'Announcements' }))
    await screen.findByText('<script>alert(1)</script>')
    expect(container.querySelector('script')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Coursework' }))
    await screen.findByText('Essay')
    expect(screen.getByText(/Good work/)).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /submit|transfer|edit/i }),
    ).toBeNull()
  })
})
