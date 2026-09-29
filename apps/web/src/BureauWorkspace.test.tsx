import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BureauWorkspace, SchoolReportingWorkspace } from './BureauWorkspace'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)
afterEach(() => fetchMock.mockReset())
const ok = (value: unknown) => ({ ok: true, json: async () => value })
const period = {
  id: 'period-1',
  name: 'Term report',
  status: 'open',
  startsOn: '2026-01-01',
  endsOn: '2026-06-01',
  submissionDueOn: '2026-06-10',
  opensAt: '2026-01-02',
  dueAt: '2026-06-09',
  closesAt: '2026-06-11',
  requirements: [],
}
const submission = {
  id: 'submission-1',
  status: 'returned',
  currentVersion: 1,
  acceptedVersion: null,
  snapshot: { enrollment: { dataState: 'reported', total: 12 } },
  versions: [
    {
      id: 'version-1',
      version: 1,
      submittedAt: '2026-06-01T00:00:00Z',
      provenance: 'legacyBackfill',
      integrityState: 'legacyUnverified',
      snapshotChecksum: null,
      snapshot: { enrollment: { dataState: 'reported', total: 12 } },
    },
  ],
  returnReason: 'Correct official enrollment records',
  school: { id: 'school-1', name: 'School' },
  reportingPeriod: { id: 'period-1', name: 'Term report' },
}
const report = {
  reportingPeriodId: 'period-1',
  reportingPeriod: period,
  school: { id: 'school-1', name: 'School' },
  submission,
}

describe('reporting review workspaces', () => {
  it('shows readiness and history, then resubmits a returned report with reason', async () => {
    let status = 'returned'
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/schools/school-1/reporting'))
        return ok([{ ...report, submission: { ...submission, status } }])
      if (url.endsWith('/readiness'))
        return ok({ ready: true, warnings: [], blocking: [] })
      if (url.endsWith('/notes')) return ok([])
      if (url.endsWith('/resubmit') && init?.method === 'POST') {
        status = 'submitted'
        return ok({ ...submission, status })
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    render(
      <SchoolReportingWorkspace
        baseUrl="https://api.example"
        schoolId="school-1"
      />,
    )
    expect(
      await screen.findByText('Submission status: returned'),
    ).not.toBeNull()
    expect(screen.getByText(/Correct official enrollment/)).not.toBeNull()
    expect(await screen.findByText('Ready to submit')).not.toBeNull()
    expect(screen.getByText(/Version 1, submitted/)).not.toBeNull()
    expect(
      screen.getByText(
        /last recoverable legacy state; earlier attempts and original checksum unavailable/,
      ),
    ).not.toBeNull()
    fireEvent.change(screen.getByLabelText('Resubmission reason'), {
      target: { value: 'Corrected approved aggregate' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Resubmit report' }))
    await waitFor(() =>
      expect(screen.getByText('Submission status: submitted')).not.toBeNull(),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/resubmit'),
      expect.objectContaining({
        body: JSON.stringify({ reason: 'Corrected approved aggregate' }),
      }),
    )
  })

  it('shows manager coverage, review controls and server-backed export choices', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/periods')) return ok([period])
      if (url.endsWith('/schools'))
        return ok([{ id: 'school-1', name: 'School' }])
      if (url.endsWith('/submissions')) return ok([])
      if (url.endsWith('/coverage'))
        return ok({
          coverage: {
            expected: 0,
            draft: 0,
            submitted: 0,
            underReview: 0,
            approved: 0,
            returned: 0,
            missing: 0,
          },
          schools: [],
        })
      if (url.endsWith('/validation')) return ok({ issues: [] })
      throw new Error(`Unexpected request: ${url}`)
    })
    render(
      <BureauWorkspace
        baseUrl="https://api.example"
        access={{
          organizationId: 'organization-1',
          role: 'reportManager',
          organization: { id: 'organization-1', name: 'Regional Bureau' },
        }}
      />,
    )
    expect(
      await screen.findByRole('button', { name: 'Require report' }),
    ).not.toBeNull()
    expect(
      screen.getByRole('button', { name: 'Export coverage CSV' }),
    ).not.toBeNull()
  })

  it('shows accepted version and school-visible review note', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/schools/school-1/reporting'))
        return ok([
          {
            ...report,
            submission: {
              ...submission,
              status: 'approved',
              acceptedVersion: 1,
            },
          },
        ])
      if (url.endsWith('/readiness'))
        return ok({ ready: true, warnings: [], blocking: [] })
      if (url.endsWith('/notes'))
        return ok([
          {
            id: 'note-1',
            version: 1,
            body: 'Accepted totals',
            visibility: 'schoolAndBureau',
            createdAt: '2026-06-01',
            authorUser: { displayName: 'Reviewer' },
          },
        ])
      throw new Error(`Unexpected request: ${url}`)
    })
    render(
      <SchoolReportingWorkspace
        baseUrl="https://api.example"
        schoolId="school-1"
      />,
    )
    expect(await screen.findByText('Accepted version: 1')).not.toBeNull()
    expect(await screen.findByText(/Accepted totals/)).not.toBeNull()
    expect(screen.queryByText(/bureauInternal/)).toBeNull()
  })
})
