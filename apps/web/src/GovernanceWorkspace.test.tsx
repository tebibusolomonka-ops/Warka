import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GovernanceWorkspace } from './GovernanceWorkspace'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  cleanup()
  fetchMock.mockReset()
})

const organizationId = '526f9981-eb0c-44b4-b13f-e0cb4f899032'
const schoolId = 'd7bb3f34-35e0-4c57-ab82-93dfb961a823'
const reviewId = '2f61e15a-9034-4c9e-bf2b-a7f6df76968c'
const entryId = 'a1503582-1003-4e88-9422-673936e0edbb'

describe('governance workspace', () => {
  it('creates a review and records explicit assignment decisions', async () => {
    let created = false
    let decision: 'pending' | 'confirmed' = 'pending'
    fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const json = async () => {
        if (url.endsWith('/audit?take=50')) return []
        if (url.endsWith('/retention')) return []
        if (url.includes('/support/identities')) return []
        if (url.includes('/support/grants')) return []
        if (url.endsWith('/reviews') && init?.method === 'POST') {
          created = true
          return { id: reviewId, entries: [] }
        }
        if (url.endsWith('/reviews'))
          return created
            ? [{ id: reviewId, status: 'open', startedAt: '2026-09-26' }]
            : []
        if (url.includes(`/reviews/${reviewId}/entries/`)) {
          decision = 'confirmed'
          return { id: entryId, decision }
        }
        if (url.endsWith(`/reviews/${reviewId}`))
          return {
            id: reviewId,
            status: 'open',
            startedAt: '2026-09-26',
            entries: [
              {
                id: entryId,
                userId: 'user-1',
                accessType: 'schoolMembership',
                currentRole: 'teacher',
                decision,
                user: {
                  displayName: 'Reviewed Teacher',
                  email: 'teacher@example.test',
                },
              },
            ],
          }
        return []
      }
      return { ok: true, json }
    })
    render(
      <GovernanceWorkspace
        baseUrl="https://api.example"
        organizationId={organizationId}
        schoolId={schoolId}
      />,
    )
    expect(
      await screen.findByRole('heading', { name: 'Security governance' }),
    ).not.toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Create access review' }),
    )
    const confirm = await screen.findByRole('button', {
      name: 'Confirm Reviewed Teacher',
    })
    fireEvent.click(confirm)
    await waitFor(() =>
      expect(screen.getByText(/teacher.*confirmed/)).not.toBeNull(),
    )
    expect(
      screen.getByText(/Creating a review changes no access/),
    ).not.toBeNull()
  })

  it('labels retention evaluation as informational and exposes no deletion action', async () => {
    fetchMock.mockImplementation(async (input: string) => {
      const url = String(input)
      return {
        ok: true,
        json: async () =>
          url.includes('/support/') || url.endsWith('/reviews') ? [] : [],
      }
    })
    render(
      <GovernanceWorkspace
        baseUrl="https://api.example"
        organizationId={organizationId}
      />,
    )
    expect(
      await screen.findByText(
        'Evaluation is informational. It does not archive or delete records.',
      ),
    ).not.toBeNull()
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
  })
})
