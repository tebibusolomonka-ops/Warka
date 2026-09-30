import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { StatusLabel } from './StatusLabel'

it('shows status as visible text even without color styling', () => {
  render(<StatusLabel status="pending" context="Enrollment" />)
  expect(screen.getByText('Enrollment: pending').textContent).toBe(
    'Enrollment: pending',
  )
})

it.each([
  ['en', 'Pending'],
  ['am', 'በመጠባበቅ ላይ'],
  ['om', 'Eeggachaa jira'],
])(
  'localizes controlled states for %s while preserving the code',
  (locale, label) => {
    render(<StatusLabel status="pending" locale={locale} />)
    const status = screen.getByText(label)
    expect(status.getAttribute('data-status')).toBe('pending')
  },
)
