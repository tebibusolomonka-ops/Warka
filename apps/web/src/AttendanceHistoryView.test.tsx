import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AttendanceHistoryView } from './AttendanceHistoryView'

describe('family attendance history', () => {
  it('shows only factual finalized status fields', async () => {
    const load = vi
      .fn()
      .mockResolvedValue({
        records: [
          {
            id: 'record',
            date: '2026-09-28T00:00:00.000Z',
            className: 'A',
            subjectName: 'Math',
            status: 'late',
          },
        ],
        nextCursor: null,
      })
    render(<AttendanceHistoryView requestKey="child" load={load} />)
    expect(await screen.findByText('late')).toBeTruthy()
    expect(screen.getByRole('table').textContent).toContain('2026-09-28')
    expect(screen.queryByText(/internal|risk|rank/i)).toBeNull()
    expect(load).toHaveBeenCalledOnce()
  })
})
