import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { ResponsiveTable } from './ResponsiveTable'

it('preserves table semantics and critical values', () => {
  render(
    <ResponsiveTable
      caption="Students"
      rows={[{ id: '1', name: 'Ada', status: 'Active' }]}
      rowKey={(row) => row.id}
      columns={[
        { key: 'name', label: 'Name', render: (row) => row.name },
        { key: 'status', label: 'Status', render: (row) => row.status },
      ]}
    />,
  )
  expect(screen.getByRole('table', { name: 'Students' })).toBeTruthy()
  expect(screen.getByText('Active').getAttribute('data-label')).toBe('Status')
})
