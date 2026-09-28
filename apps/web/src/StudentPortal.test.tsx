import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StudentPortal } from './StudentPortal'
vi.mock('./StudentCourseworkWorkspace', () => ({
  StudentCourseworkWorkspace: () => null,
}))
import {
  getStudentAnnouncements,
  getStudentMaterials,
  getStudentResults,
} from './api'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  getStudentAnnouncements: vi.fn(),
  getStudentMaterials: vi.fn(),
  getStudentResults: vi.fn(),
}))
const baseUrl = 'http://localhost:3000/api'
const identity = {
  studentReference: 'WKA-SYNTHETIC',
  givenName: 'Hana',
  familyName: null,
  currentEnrollment: null,
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getStudentResults).mockResolvedValue([])
  vi.mocked(getStudentMaterials).mockResolvedValue([])
  vi.mocked(getStudentAnnouncements).mockResolvedValue([])
})
afterEach(cleanup)

describe('student resources', () => {
  it('links uploaded material to the authenticated Warka download route', async () => {
    vi.mocked(getStudentMaterials).mockResolvedValue([
      {
        id: '123e4567-e89b-42d3-a456-426614174090',
        schoolId: '123e4567-e89b-42d3-a456-426614174091',
        title: 'Worksheet',
        description: null,
        resourceType: 'file',
        resourceLocation: '',
        assetId: '123e4567-e89b-42d3-a456-426614174092',
        subject: 'Math',
        academicYear: '2026',
        publishedAt: '2026-09-24T00:00:00.000Z',
      },
    ])
    render(
      <StudentPortal
        baseUrl={baseUrl}
        identity={identity}
        onSessionExpired={vi.fn()}
        onSignOut={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Materials' }))
    const link = await screen.findByRole('link', { name: 'Download file' })
    expect(link.getAttribute('href')).toBe(
      `${baseUrl}/schools/123e4567-e89b-42d3-a456-426614174091/materials/123e4567-e89b-42d3-a456-426614174090/download`,
    )
  })
  it('groups materials by subject, opens only safe links, and renders descriptions as text', async () => {
    vi.mocked(getStudentMaterials).mockResolvedValue([
      {
        id: '123e4567-e89b-42d3-a456-426614174010',
        title: 'Algebra',
        description: '<b>Practice</b>',
        resourceType: 'link',
        resourceLocation: 'https://school.example.test/algebra',
        subject: 'Math',
        academicYear: '2026',
        publishedAt: '2026-09-24T00:00:00.000Z',
      },
      {
        id: '123e4567-e89b-42d3-a456-426614174011',
        title: 'Plants',
        description: null,
        resourceType: 'link',
        resourceLocation: 'javascript:alert(1)',
        subject: 'Science',
        academicYear: '2026',
        publishedAt: '2026-09-24T00:00:00.000Z',
      },
    ])
    render(
      <StudentPortal
        baseUrl={baseUrl}
        identity={identity}
        onSessionExpired={vi.fn()}
        onSignOut={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Materials' }))
    await screen.findByText('Algebra')
    expect(screen.getByText('2026 - Math')).toBeTruthy()
    expect(screen.getByText('2026 - Science')).toBeTruthy()
    expect(screen.getByText('<b>Practice</b>')).toBeTruthy()
    const links = screen.getAllByRole('link', { name: 'Open resource' })
    expect(links).toHaveLength(1)
    expect(links[0]?.getAttribute('target')).toBe('_blank')
    expect(links[0]?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('shows active announcement text and empty states without HTML rendering', async () => {
    vi.mocked(getStudentAnnouncements).mockResolvedValue([
      {
        id: '123e4567-e89b-42d3-a456-426614174012',
        title: 'Class trip',
        body: '<script>text</script>',
        publishedAt: '2026-09-24T00:00:00.000Z',
        scope: { type: 'class', name: 'Class A' },
      },
    ])
    render(
      <StudentPortal
        baseUrl={baseUrl}
        identity={identity}
        onSessionExpired={vi.fn()}
        onSignOut={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Materials' }))
    await screen.findByText('No learning materials yet.')
    fireEvent.click(screen.getByRole('button', { name: 'Announcements' }))
    await screen.findByText('Class trip')
    expect(screen.getByText('<script>text</script>')).toBeTruthy()
    expect(screen.getByText(/Class A/)).toBeTruthy()
  })
})
