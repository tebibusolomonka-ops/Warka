import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BureauWorkspace, SchoolReportingWorkspace } from './BureauWorkspace'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => fetchMock.mockReset())

describe('school reporting workspace', () => {
  it('shows returned aggregate reports and resubmits from official data', async () => {
    const report = {
      reportingPeriodId: 'period-1',
      reportingPeriod: {
        id: 'period-1',
        name: 'Term report',
        status: 'open',
        startsOn: '2026-01-01',
        endsOn: '2026-06-01',
        submissionDueOn: '2026-06-10',
        requirements: [],
      },
      school: { id: 'school-1', name: 'School' },
      submission: {
        id: 'submission-1',
        status: 'returned',
        snapshot: { enrollment: { total: 12 } },
        returnReason: 'Correct official enrollment records',
        school: { id: 'school-1', name: 'School' },
        reportingPeriod: { id: 'period-1', name: 'Term report' },
      },
    }
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [report] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...report.submission, status: 'submitted' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            ...report,
            submission: { ...report.submission, status: 'submitted' },
          },
        ],
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
    expect(screen.getByText(/"total": 12/)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Resubmit report' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
  })
  it('shows assignment controls only to report managers', async () => {
    const period = {
      id: 'period-1',
      name: 'Term report',
      status: 'open',
      startsOn: '2026-01-01',
      endsOn: '2026-06-01',
      submissionDueOn: '2026-06-10',
      requirements: [],
    }
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [period] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'school-1', name: 'First School' }],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          coverage: {
            expected: 0,
            draft: 0,
            submitted: 0,
            approved: 0,
            returned: 0,
            missing: 0,
          },
          schools: [],
        }),
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
  })
})
