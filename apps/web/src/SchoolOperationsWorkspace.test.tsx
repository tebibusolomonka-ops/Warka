import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { SchoolOperationsWorkspace } from './SchoolOperationsWorkspace'
import {
  applySchoolImport,
  downloadSchoolExport,
  getSchoolImport,
  listSchoolImports,
  uploadSchoolImport,
  type ImportJob,
} from './schoolOperationsApi'

vi.mock('./schoolOperationsApi', async (original) => ({
  ...(await original<typeof import('./schoolOperationsApi')>()),
  applySchoolImport: vi.fn(),
  cancelSchoolImport: vi.fn(),
  downloadSchoolExport: vi.fn(),
  getSchoolImport: vi.fn(),
  listSchoolImports: vi.fn(),
  uploadSchoolImport: vi.fn(),
  validateSchoolImport: vi.fn(),
}))
const schoolId = '9d113102-69c3-436b-ab9b-45f65f47ed4a'
const job: ImportJob = {
  id: '08b6fcb4-07b6-4fbe-8ad7-0f6001db315c',
  schoolId,
  status: 'validated',
  originalFileName: 'synthetic.csv',
  totalRows: 1,
  validRows: 1,
  invalidRows: 0,
  createdAt: '2026-09-26T00:00:00.000Z',
  issues: [
    {
      rowNumber: 2,
      severity: 'warning',
      code: 'possibleDuplicate',
      message: 'Review possible duplicate.',
    },
  ],
}
beforeEach(() => {
  vi.mocked(listSchoolImports).mockResolvedValue([])
  vi.mocked(uploadSchoolImport).mockResolvedValue(job)
  vi.mocked(getSchoolImport).mockResolvedValue(job)
  vi.mocked(applySchoolImport).mockResolvedValue({
    job: { ...job, status: 'applied' },
    created: [{ studentId: 'student-1', studentReference: 'WKA-1' }],
  })
  vi.mocked(downloadSchoolExport).mockResolvedValue()
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
describe('school operations', () => {
  it('shows warnings, requires acknowledgement, applies, and offers only named exports', async () => {
    const onApplied = vi.fn()
    render(
      <SchoolOperationsWorkspace
        baseUrl="/api"
        schoolId={schoolId}
        onApplied={onApplied}
        onSessionExpired={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'School operations' }))
    const file = new File(
      ['givenName,academicYearId,gradeLevelId\nSynthetic,a,b'],
      'synthetic.csv',
      { type: 'text/csv' },
    )
    Object.defineProperty(file, 'text', {
      value: async () => 'givenName,academicYearId,gradeLevelId\nSynthetic,a,b',
    })
    fireEvent.change(screen.getByLabelText('Student registration CSV'), {
      target: { files: [file] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Upload and validate' }))
    expect(await screen.findByText(/Review possible duplicate/)).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: 'Apply import' })
        .hasAttribute('disabled'),
    ).toBe(true)
    fireEvent.click(
      screen.getByRole('checkbox', { name: /I reviewed duplicate warnings/ }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Apply import' }))
    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1))
    expect(applySchoolImport).toHaveBeenCalledWith(
      '/api',
      schoolId,
      job.id,
      true,
    )
    expect(
      screen.getByRole('button', { name: 'Export student roster' }),
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Export student roster' }),
    )
    await waitFor(() =>
      expect(downloadSchoolExport).toHaveBeenCalledWith(
        '/api',
        schoolId,
        'studentRoster',
      ),
    )
  })
  it('rejects oversized or non-CSV selection before upload', async () => {
    render(
      <SchoolOperationsWorkspace
        baseUrl="/api"
        schoolId={schoolId}
        onApplied={vi.fn()}
        onSessionExpired={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'School operations' }))
    fireEvent.change(screen.getByLabelText('Student registration CSV'), {
      target: { files: [new File(['bad'], 'bad.txt')] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Upload and validate' }))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Select a CSV file no larger than 1 MB.',
    )
    expect(uploadSchoolImport).not.toHaveBeenCalled()
  })
})
